use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn open_devtools(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        window.open_devtools();
        println!("[DevTools] Opened");
    }
}

#[tauri::command]
pub fn close_devtools(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        window.close_devtools();
        println!("[DevTools] Closed");
    }
}

#[tauri::command]
pub fn is_devtools_open(app: AppHandle) -> bool {
    if let Some(window) = app.get_webview_window("main") {
        window.is_devtools_open()
    } else {
        false
    }
}
