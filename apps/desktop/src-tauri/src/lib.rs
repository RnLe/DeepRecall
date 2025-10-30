// Module declarations
mod commands;
mod db;
mod logger;

use commands::{avatars, blobs, database, devtools};
use tauri::Manager;

// Load environment variables from .env.local
fn load_env() {
    use std::path::PathBuf;
    
    // Get the directory where the Tauri app is located
    let app_dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    
    // Try multiple possible locations for .env.local
    let mut env_locations = vec![
        PathBuf::from("../.env.local"),           // Development: relative to src-tauri
        PathBuf::from(".env.local"),              // Current directory
        app_dir.join(".env.local"),               // Same directory as binary
    ];
    
    // Add parent directory if it exists
    if let Some(parent) = app_dir.parent() {
        env_locations.push(parent.join(".env.local"));
    }
    
    let mut loaded = false;
    for location in env_locations.iter() {
        println!("[Env] Checking: {}", location.display());
        if location.exists() {
            println!("[Env] Found! Loading from: {}", location.display());
            if let Ok(_) = dotenv::from_path(location) {
                loaded = true;
                break;
            }
        }
    }
    
    if !loaded {
        println!("[Env] No .env.local found, trying .env");
        let _ = dotenv::from_filename("../.env");
    }
    
    // Debug: Print loaded Postgres config
    println!("[Env] VITE_POSTGRES_HOST = {}", std::env::var("VITE_POSTGRES_HOST").unwrap_or_else(|_| "NOT SET".to_string()));
    println!("[Env] VITE_POSTGRES_SSL = {}", std::env::var("VITE_POSTGRES_SSL").unwrap_or_else(|_| "NOT SET".to_string()));
    if let Ok(host) = std::env::var("VITE_POSTGRES_HOST") {
        println!("[Env] VITE_POSTGRES_HOST={}", host);
    }
    if let Ok(db) = std::env::var("VITE_POSTGRES_DB") {
        println!("[Env] VITE_POSTGRES_DB={}", db);
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logger first
    logger::init_logger();
    app_log!("DeepRecall starting...");
    
    // Load environment variables before starting Tauri
    load_env();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Open DevTools on Windows builds if TAURI_OPEN_DEVTOOLS is set
            // Usage: Set environment variable TAURI_OPEN_DEVTOOLS=1 before launching
            if std::env::var("TAURI_OPEN_DEVTOOLS").is_ok() {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                    app_log!("DevTools opened via TAURI_OPEN_DEVTOOLS");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            logger::get_log_path,
            // DevTools commands
            devtools::open_devtools,
            devtools::close_devtools,
            devtools::is_devtools_open,
            // Blob commands
            blobs::list_blobs,
            blobs::stat_blob,
            blobs::store_blob,
            blobs::delete_blob,
            blobs::rename_blob,
            blobs::scan_blobs,
            blobs::health_check,
            blobs::get_blob_stats,
            blobs::read_blob,
            blobs::sync_blob_to_electric,
            blobs::clear_all_blobs,
            // Database commands
            database::flush_writes,
            database::clear_all_database,
            database::export_all_data,
            database::estimate_export_size,
            database::import_data,
            database::query_postgres_table,
            database::query_all_postgres_tables,
            // Avatar commands
            avatars::upload_avatar,
            avatars::delete_avatar,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
