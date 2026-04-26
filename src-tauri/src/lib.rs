mod commands;
mod db;

use commands::ActiveDownloads;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let active_downloads: ActiveDownloads = Arc::new(Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(active_downloads)
        .invoke_handler(tauri::generate_handler![
            commands::fetch_metadata,
            commands::start_download,
            commands::cancel_download,
            commands::get_history,
            commands::save_download_record,
            commands::clear_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
