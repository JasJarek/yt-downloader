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

fn find_sidecar(app: &AppHandle, name: &str) -> Option<std::path::PathBuf> {
    use tauri::Manager;

    let names = [name.to_string(), format!("{}.exe", name)];

    // 1. Production: bundled in resource_dir/binaries/
    for n in &names {
        if let Ok(p) = app.path().resource_dir().map(|d| d.join("binaries").join(n)) {
            if p.exists() {
                return Some(p);
            }
        }
    }

    // 2. Production (Windows MSI/NSIS): resources placed next to the .exe
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            for n in &names {
                let p = exe_dir.join("binaries").join(n);
                if p.exists() {
                    return Some(p);
                }
                // Some Tauri installers flatten resources next to the exe
                let p2 = exe_dir.join(n);
                if p2.exists() {
                    return Some(p2);
                }
            }

            // 3. Dev mode: exe is at src-tauri/target/debug/ — binaries at src-tauri/binaries/
            let dev_base = exe_dir.join("..").join("..").join("binaries");
            for n in &names {
                if let Ok(canonical) = dev_base.join(n).canonicalize() {
                    if canonical.exists() {
                        return Some(canonical);
                    }
                }
            }
        }
    }

    None
}

#[tauri::command]
pub async fn fetch_metadata(app: AppHandle, url: String) -> Result<VideoMetadata, String> {
    let ytdlp = find_sidecar(&app, "yt-dlp")
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "yt-dlp".to_string());

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
            // Prefer H.264+AAC (native MP4, universally smooth playback).
            // Fall back to any codec if H.264 isn't available at this height.
            format_id: format!(
                "bestvideo[height<={h}][vcodec^=avc]+bestaudio[acodec^=mp4a]/bestvideo[height<={h}]+bestaudio"
            ),
            height: Some(h),
            fps: None,
            label: format!("{h}p"),
        })
        .collect();

    if video_formats.is_empty() {
        video_formats.push(VideoFormat {
            format_id: "bestvideo[vcodec^=avc]+bestaudio[acodec^=mp4a]/bestvideo+bestaudio".to_string(),
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

    let ytdlp = find_sidecar(&app, "yt-dlp")
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "yt-dlp".to_string());

    let ffmpeg_path = find_sidecar(&app, "ffmpeg");

    // Verify ffmpeg is actually executable before starting a video download
    if request.format != "mp3" {
        match &ffmpeg_path {
            None => {
                return Err("FFmpeg nie został znaleziony. Sprawdź instalację aplikacji.".to_string());
            }
            Some(p) => {
                let check = Command::new(p).arg("-version").output().await;
                if check.is_err() {
                    return Err(format!(
                        "FFmpeg nie można uruchomić (ścieżka: {}). Sprawdź instalację.",
                        p.display()
                    ));
                }
            }
        }
    }

    // Pass ffmpeg directory to yt-dlp (accepts both binary path and directory)
    let ffmpeg_location = ffmpeg_path
        .as_ref()
        .and_then(|p| p.parent())
        .map(|d| d.to_string_lossy().to_string());

    let app_clone = app.clone();
    let id_clone = id.clone();

    let mut args: Vec<String> = Vec::new();

    if let Some(loc) = ffmpeg_location {
        args.extend(["--ffmpeg-location".to_string(), loc]);
    }

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
        .map_err(|e| format!("Nie można uruchomić yt-dlp: {e}"))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let mut out_reader = BufReader::new(stdout).lines();
    let mut err_reader = BufReader::new(stderr).lines();

    tokio::spawn(async move {
        loop {
            tokio::select! {
                line = out_reader.next_line() => {
                    match line {
                        Ok(Some(line)) => {
                            let progress = parse_progress(&id_clone, &line);
                            let _ = app_clone.emit("download-progress", &progress);
                        }
                        Ok(None) => break,
                        Err(_) => break,
                    }
                }
                line = err_reader.next_line() => {
                    if let Ok(Some(line)) = line {
                        // Surface important stderr messages (ffmpeg errors, warnings)
                        if line.contains("ffmpeg") || line.contains("ERROR") || line.contains("WARNING") {
                            let _ = app_clone.emit("download-progress", &DownloadProgress {
                                id: id_clone.clone(),
                                percent: 0.0,
                                speed: String::new(),
                                eta: String::new(),
                                stage: format!("warn:{}", line.trim()),
                            });
                        }
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
