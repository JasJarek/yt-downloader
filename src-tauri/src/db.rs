use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadRecord {
    pub id: String,
    pub title: String,
    pub url: String,
    pub format: String,
    pub quality: String,
    pub file_path: String,
    pub status: String,
    pub created_at: String,
}

pub fn get_db_path() -> String {
    let data_dir = dirs_next::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("yt-downloader");
    std::fs::create_dir_all(&data_dir).ok();
    data_dir.join("history.db").to_string_lossy().to_string()
}

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS downloads (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            format TEXT NOT NULL,
            quality TEXT NOT NULL,
            file_path TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL
        );",
    )
}

pub fn insert_record(conn: &Connection, record: &DownloadRecord) -> Result<()> {
    conn.execute(
        "INSERT INTO downloads (id, title, url, format, quality, file_path, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            record.id,
            record.title,
            record.url,
            record.format,
            record.quality,
            record.file_path,
            record.status,
            record.created_at,
        ],
    )?;
    Ok(())
}

pub fn get_history(conn: &Connection) -> Result<Vec<DownloadRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, url, format, quality, file_path, status, created_at
         FROM downloads ORDER BY created_at DESC LIMIT 200",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(DownloadRecord {
            id: row.get(0)?,
            title: row.get(1)?,
            url: row.get(2)?,
            format: row.get(3)?,
            quality: row.get(4)?,
            file_path: row.get(5)?,
            status: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;
    let mut records = Vec::new();
    for row in rows {
        records.push(row?);
    }
    Ok(records)
}

pub fn clear_history(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM downloads", [])?;
    Ok(())
}
