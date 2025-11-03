use tauri::Window;
use serde::{Deserialize, Serialize};
use keyring::Entry;

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct AuthSession {
    pub access_token: String,
    pub user: serde_json::Value,
}

const SERVICE_NAME: &str = "dev.deeprecall.desktop";

/// Open external auth URL in system browser (DEPRECATED - use native OAuth instead)
/// This function is kept for backwards compatibility but native OAuth flows should be used
#[tauri::command]
pub async fn open_auth_window(_window: Window, provider: String) -> Result<(), String> {
    // Auth URL on Railway (production) or localhost:3000 (dev)
    let auth_base = if cfg!(debug_assertions) {
        "http://localhost:3000"
    } else {
        "https://deeprecall-production.up.railway.app"
    };
    
    // Desktop callback - web will redirect here after auth
    let callback_url = "http://localhost:3001/auth/callback";
    
    let auth_url = format!(
        "{}/auth/signin?provider={}&callbackUrl={}",
        auth_base,
        provider,
        urlencoding::encode(callback_url)
    );
    
    crate::app_log!("Opening auth URL: {}", auth_url);
    
    // Open in system browser using opener plugin
    // Note: This function is deprecated - use the native OAuth flows in oauth_server.rs instead
    let _ = tauri_plugin_opener::open_url(&auth_url, None::<&str>);
    
    Ok(())
}

/// Save a value to OS keychain
#[tauri::command]
pub async fn save_auth_session(
    key: String,
    value: String,
) -> Result<(), String> {
    crate::app_log!("Saving {} to keychain", key);
    
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    entry.set_password(&value)
        .map_err(|e| format!("Failed to save to keychain: {}", e))?;
    
    Ok(())
}

/// Get a value from OS keychain
#[tauri::command]
pub async fn get_auth_session(
    key: String,
) -> Result<Option<String>, String> {
    crate::app_log!("Getting {} from keychain", key);
    
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to get from keychain: {}", e)),
    }
}

/// Delete a value from OS keychain
#[tauri::command]
pub async fn clear_auth_session(
    key: String,
) -> Result<(), String> {
    crate::app_log!("Deleting {} from keychain", key);
    
    let entry = Entry::new(SERVICE_NAME, &key)
        .map_err(|e| format!("Failed to create keyring entry: {}", e))?;
    
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
        Err(e) => Err(format!("Failed to delete from keychain: {}", e)),
    }
}
