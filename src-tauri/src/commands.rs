use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::db::{self, DownloadRecord};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoMetadata {
    pub title: String,
    pub duration: u64,
    pub thumbnail: String,
    pub uploader: String,
    pub upload_date: String,
    pub formats: Vec<VideoFormat>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoFormat {
    pub format_id: String,
    pub height: Option<u32>,
    pub fps: Option<f64>,
    pub label: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub id: String,
    pub percent: f64,
    pub speed: String,
    pub eta: String,
    pub stage: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadRequest {
    pub id: String,
    pub url: String,
    pub format: String,
    pub quality: String,
    pub output_dir: String,
    pub title: String,
}

pub type ActiveDownloads = Arc<Mutex<HashMap<String, tokio::sync::watch::Sender<bool>>>>;

fn find_sidecar(app: &AppHandle, name: &str) -> String {
    use tauri::Manager;

    let names = [name.to_string(), format!("{}.exe", name)];

    // 1. Bundled resources (production)
    for n in &names {
        if let Ok(p) = app.path().resource_dir().map(|d| d.join("binaries").join(n)) {
            if p.exists() {
                return p.to_string_lossy().to_string();
            }
        }
    }

    // 2. Dev mode: binary lives in src-tauri/binaries/, exe in src-tauri/target/debug/
    //    exe_dir/../../../binaries would overshoot — correct path is exe_dir/../../binaries
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            // target/debug/ -> target/ -> src-tauri/ -> binaries/
            let dev_base = exe_dir.join("..").join("..").join("binaries");
            for n in &names {
                let p = dev_base.join(n);
                if let Ok(canonical) = p.canonicalize() {
                    if canonical.exists() {
                        return canonical.to_string_lossy().to_string();
                    }
                }
            }
        }
    }

    // 3. Last resort: rely on system PATH
    name.to_string()
}

#[tauri::command]
pub async fn fetch_metadata(app: AppHandle, url: String) -> Result<VideoMetadata, String> {
    let ytdlp = find_sidecar(&app, "yt-dlp");
    let output = Command::new(&ytdlp)
        .args(["--dump-json", "--no-playlist", &url])
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp error: {stderr}"));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("JSON parse error: {e}"))?;

    let title = json["title"].as_str().unwrap_or("Unknown").to_string();
    let duration = json["duration"].as_u64().unwrap_or(0);
    let thumbnail = json["thumbnail"].as_str().unwrap_or("").to_string();
    let uploader = json["uploader"].as_str().unwrap_or("").to_string();
    let upload_date = json["upload_date"].as_str().unwrap_or("").to_string();

    let mut heights: Vec<u32> = Vec::new();
    if let Some(formats) = json["formats"].as_array() {
        for f in formats {
            if let Some(h) = f["height"].as_u64() {
                let h = h as u32;
                if h > 0 && !heights.contains(&h) {
                    heights.push(h);
                }
            }
        }
    }
    heights.sort();
    heights.dedup();

    let desired = [360u32, 480, 720, 1080, 2160];
    let mut video_formats: Vec<VideoFormat> = desired
        .iter()
        .filter(|&&h| heights.contains(&h))
        .map(|&h| VideoFormat {
            format_id: format!("bestvideo[height<={h}]+bestaudio"),
            height: Some(h),
            fps: None,
            label: format!("{h}p"),
        })
        .collect();

    if video_formats.is_empty() {
        video_formats.push(VideoFormat {
            format_id: "bestvideo+bestaudio".to_string(),
            height: None,
            fps: None,
            label: "Best".to_string(),
        });
    }

    Ok(VideoMetadata {
        title,
        duration,
        thumbnail,
        uploader,
        upload_date,
        formats: video_formats,
    })
}

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    request: DownloadRequest,
    downloads: State<'_, ActiveDownloads>,
) -> Result<(), String> {
    let id = request.id.clone();
    let (cancel_tx, mut cancel_rx) = tokio::sync::watch::channel(false);
    downloads.lock().await.insert(id.clone(), cancel_tx);

    let ytdlp = find_sidecar(&app, "yt-dlp");
    let ffmpeg = find_sidecar(&app, "ffmpeg");
    let app_clone = app.clone();
    let id_clone = id.clone();

    let mut args: Vec<String> = Vec::new();

    // Always tell yt-dlp where our bundled ffmpeg is
    args.extend([
        "--ffmpeg-location".to_string(),
        ffmpeg.clone(),
    ]);

    match request.format.as_str() {
        "mp3" => {
            args.extend([
                "-x".to_string(),
                "--audio-format".to_string(),
                "mp3".to_string(),
                "--audio-quality".to_string(),
                request.quality.clone(),
                "--embed-thumbnail".to_string(),
                "--add-metadata".to_string(),
            ]);
        }
        _ => {
            // request.quality is already a full yt-dlp format selector
            // e.g. "bestvideo[height<=720]+bestaudio" — use it directly
            args.extend([
                "-f".to_string(),
                request.quality.clone(),
                "--merge-output-format".to_string(),
                "mp4".to_string(),
            ]);
        }
    }

    args.extend([
        "--newline".to_string(),
        "--no-playlist".to_string(),
        "-o".to_string(),
        format!("{}/%(title)s.%(ext)s", request.output_dir),
        request.url.clone(),
    ]);

    let mut child = Command::new(&ytdlp)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start download: {e}"))?;

    let stdout = child.stdout.take().unwrap();
    let mut reader = BufReader::new(stdout).lines();

    tokio::spawn(async move {
        loop {
            tokio::select! {
                line = reader.next_line() => {
                    match line {
                        Ok(Some(line)) => {
                            let progress = parse_progress(&id_clone, &line);
                            let _ = app_clone.emit("download-progress", &progress);
                        }
                        Ok(None) => break,
                        Err(_) => break,
                    }
                }
                _ = cancel_rx.changed() => {
                    if *cancel_rx.borrow() {
                        child.kill().await.ok();
                        let _ = app_clone.emit("download-cancelled", &id_clone);
                        return;
                    }
                }
            }
        }

        let status = child.wait().await.ok();
        let success = status.map(|s| s.success()).unwrap_or(false);

        let final_status = if success { "completed" } else { "failed" };
        let _ = app_clone.emit("download-finished", serde_json::json!({
            "id": id_clone,
            "status": final_status,
        }));
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_download(
    id: String,
    downloads: State<'_, ActiveDownloads>,
) -> Result<(), String> {
    let mut map = downloads.lock().await;
    if let Some(tx) = map.remove(&id) {
        let _ = tx.send(true);
    }
    Ok(())
}

#[tauri::command]
pub async fn get_history() -> Result<Vec<DownloadRecord>, String> {
    let path = db::get_db_path();
    let conn = rusqlite::Connection::open(&path)
        .map_err(|e| format!("DB error: {e}"))?;
    db::init_db(&conn).map_err(|e| format!("DB init: {e}"))?;
    db::get_history(&conn).map_err(|e| format!("DB query: {e}"))
}

#[tauri::command]
pub async fn save_download_record(record: DownloadRecord) -> Result<(), String> {
    let path = db::get_db_path();
    let conn = rusqlite::Connection::open(&path)
        .map_err(|e| format!("DB error: {e}"))?;
    db::init_db(&conn).map_err(|e| format!("DB init: {e}"))?;
    db::insert_record(&conn, &record).map_err(|e| format!("DB insert: {e}"))
}

#[tauri::command]
pub async fn clear_history() -> Result<(), String> {
    let path = db::get_db_path();
    let conn = rusqlite::Connection::open(&path)
        .map_err(|e| format!("DB error: {e}"))?;
    db::clear_history(&conn).map_err(|e| format!("DB clear: {e}"))
}

fn parse_progress(id: &str, line: &str) -> DownloadProgress {
    // yt-dlp outputs lines like:
    // [download]  12.5% of 45.23MiB at 2.34MiB/s ETA 00:18
    let mut percent = 0.0f64;
    let mut speed = String::new();
    let mut eta = String::new();
    let mut stage = "downloading".to_string();

    if line.contains("[download]") {
        if let Some(pct_str) = line.split('%').next() {
            let trimmed = pct_str.split_whitespace().last().unwrap_or("0");
            percent = trimmed.parse().unwrap_or(0.0);
        }
        if let Some(at_pos) = line.find(" at ") {
            let rest = &line[at_pos + 4..];
            speed = rest.split_whitespace().next().unwrap_or("").to_string();
        }
        if let Some(eta_pos) = line.find("ETA ") {
            eta = line[eta_pos + 4..].split_whitespace().next().unwrap_or("").to_string();
        }
    } else if line.contains("[Merger]") || line.contains("[ffmpeg]") {
        stage = "converting".to_string();
        percent = 99.0;
    }

    DownloadProgress {
        id: id.to_string(),
        percent,
        speed,
        eta,
        stage,
    }
}
