use std::fs::{OpenOptions, File};
use std::io::Write;
use std::sync::Mutex;
use std::path::PathBuf;
use lazy_static::lazy_static;

lazy_static! {
    static ref LOG_FILE: Mutex<Option<File>> = Mutex::new(None);
    static ref LOG_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);
}

pub fn init_logger() {
    // Create log file in user's home directory or temp
    let log_path = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("DeepRecall")
        .join("deeprecall.log");

    // Create directory if it doesn't exist
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    match OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        Ok(file) => {
            *LOG_FILE.lock().unwrap() = Some(file);
            *LOG_PATH.lock().unwrap() = Some(log_path.clone());
            log(&format!("=== DeepRecall started at {} ===", chrono::Local::now()));
            log(&format!("Log file: {}", log_path.display()));
        }
        Err(e) => {
            eprintln!("Failed to create log file: {}", e);
        }
    }
}

#[tauri::command]
pub fn get_log_path() -> String {
    LOG_PATH.lock()
        .unwrap()
        .as_ref()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| "Log file not initialized".to_string())
}

pub fn log(message: &str) {
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
    let log_line = format!("[{}] {}\n", timestamp, message);
    
    // Print to stdout (visible in dev console)
    print!("{}", log_line);
    
    // Write to log file
    if let Some(ref mut file) = *LOG_FILE.lock().unwrap() {
        let _ = file.write_all(log_line.as_bytes());
        let _ = file.flush();
    }
}

#[macro_export]
macro_rules! app_log {
    ($($arg:tt)*) => {
        $crate::logger::log(&format!($($arg)*))
    };
}
