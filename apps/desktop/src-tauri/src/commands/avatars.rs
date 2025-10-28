/**
 * Avatar management commands
 */

use anyhow::{Context, Result};
use base64::{Engine as _, engine::general_purpose};
use std::fs;
use std::path::PathBuf;

/// Get avatars directory
fn get_avatars_dir() -> Result<PathBuf> {
    let home_dir = dirs::home_dir().context("Failed to get home directory")?;
    let avatars_dir = home_dir.join("DeepRecall").join("avatars");
    fs::create_dir_all(&avatars_dir)?;
    Ok(avatars_dir)
}

/// Upload avatar (save original and display versions)
#[tauri::command]
pub async fn upload_avatar(
    author_id: String,
    original_base64: String,
    display_base64: String,
    crop_region: String,
) -> Result<serde_json::Value, String> {
    let avatars_dir = get_avatars_dir().map_err(|e| e.to_string())?;

    // Decode base64
    let original_data = general_purpose::STANDARD.decode(&original_base64).map_err(|e| e.to_string())?;
    let display_data = general_purpose::STANDARD.decode(&display_base64).map_err(|e| e.to_string())?;

    // Create filenames
    let timestamp = chrono::Utc::now().timestamp();
    let original_filename = format!("{}_original_{}.jpg", author_id, timestamp);
    let display_filename = format!("{}_display_{}.jpg", author_id, timestamp);

    let original_path = avatars_dir.join(&original_filename);
    let display_path = avatars_dir.join(&display_filename);

    // Write files
    fs::write(&original_path, original_data).map_err(|e| e.to_string())?;
    fs::write(&display_path, display_data).map_err(|e| e.to_string())?;

    // Parse crop region
    let crop: serde_json::Value = serde_json::from_str(&crop_region).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "paths": {
            "original": original_path.to_string_lossy(),
            "display": display_path.to_string_lossy()
        },
        "cropRegion": crop
    }))
}

/// Delete avatar file
#[tauri::command]
pub async fn delete_avatar(path: String) -> Result<(), String> {
    let avatar_path = PathBuf::from(&path);
    
    if avatar_path.exists() {
        fs::remove_file(avatar_path).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
