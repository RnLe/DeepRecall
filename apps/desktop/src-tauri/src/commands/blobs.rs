/**
 * Blob storage commands for Tauri
 */

use crate::db::{
    delete_blob as db_delete_blob, get_blob_by_hash, get_connection, get_stats, insert_blob,
    insert_path, list_all_blobs, update_filename, BlobInfo, BlobWithMetadata, HealthReport,
    ScanResult,
};
use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Get the blob storage directory path
fn get_blobs_dir() -> Result<PathBuf> {
    let home_dir = dirs::home_dir().context("Failed to get home directory")?;
    let blobs_dir = home_dir.join("DeepRecall").join("blobs");
    fs::create_dir_all(&blobs_dir)?;
    Ok(blobs_dir)
}

/// Get MIME type from file extension
fn get_mime_type(path: &Path) -> String {
    mime_guess::from_path(path)
        .first_or_octet_stream()
        .to_string()
}

/// List all blobs with metadata
#[tauri::command]
pub async fn list_blobs(orphaned_only: bool) -> Result<Vec<BlobWithMetadata>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let blobs = list_all_blobs(&conn).map_err(|e| e.to_string())?;

    if orphaned_only {
        // TODO: Filter orphaned blobs (no associated asset)
        // For now, return all blobs
        Ok(blobs)
    } else {
        Ok(blobs)
    }
}

/// Get blob metadata by SHA-256 hash
#[tauri::command]
pub async fn stat_blob(sha256: String) -> Result<Option<BlobInfo>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    get_blob_by_hash(&conn, &sha256).map_err(|e| e.to_string())
}

/// Store a new blob
#[tauri::command]
pub async fn store_blob(
    filename: String,
    data: Vec<u8>,
    mime: String,
) -> Result<BlobWithMetadata, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let blobs_dir = get_blobs_dir().map_err(|e| e.to_string())?;

    // Calculate SHA-256 hash
    let mut hasher = Sha256::new();
    hasher.update(&data);
    let hash = format!("{:x}", hasher.finalize());

    // Create subdirectory based on first 2 chars of hash (for better filesystem performance)
    let subdir = blobs_dir.join(&hash[..2]);
    fs::create_dir_all(&subdir).map_err(|e| e.to_string())?;

    // Store file with hash as name
    let file_path = subdir.join(&hash);
    fs::write(&file_path, &data).map_err(|e| e.to_string())?;

    // Get file metadata
    let metadata = fs::metadata(&file_path).map_err(|e| e.to_string())?;
    let mtime_ms = metadata
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64;

    // Insert into database
    insert_blob(
        &conn,
        &hash,
        data.len() as i64,
        &mime,
        mtime_ms,
        Some(&filename),
    )
    .map_err(|e| e.to_string())?;

    insert_path(&conn, &hash, file_path.to_str().unwrap()).map_err(|e| e.to_string())?;

    Ok(BlobWithMetadata {
        sha256: hash,
        filename: Some(filename),
        size: data.len() as i64,
        mime,
        created_ms: chrono::Utc::now().timestamp_millis(),
        mtime_ms,
        path: Some(file_path.to_string_lossy().to_string()),
        health: Some("healthy".to_string()),
        page_count: None,
        image_width: None,
        image_height: None,
        line_count: None,
    })
}

/// Delete a blob
#[tauri::command]
pub async fn delete_blob(sha256: String) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    // Get file path before deleting from database
    if let Some(blob_info) = get_blob_by_hash(&conn, &sha256).map_err(|e| e.to_string())? {
        if let Some(path) = blob_info.path {
            // Delete file from filesystem
            if let Err(e) = fs::remove_file(&path) {
                eprintln!("Failed to delete file {}: {}", path, e);
            }
        }
    }

    // Delete from database
    db_delete_blob(&conn, &sha256).map_err(|e| e.to_string())?;

    Ok(())
}

/// Rename a blob (update filename in catalog)
#[tauri::command]
pub async fn rename_blob(sha256: String, filename: String) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    update_filename(&conn, &sha256, &filename).map_err(|e| e.to_string())
}

/// Scan filesystem for blobs
#[tauri::command]
pub async fn scan_blobs() -> Result<ScanResult, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let blobs_dir = get_blobs_dir().map_err(|e| e.to_string())?;

    let mut added = 0;
    let mut updated = 0;
    let mut errors = Vec::new();

    // Walk through blobs directory
    for entry in WalkDir::new(&blobs_dir)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();
        let file_name = match path.file_name() {
            Some(name) => name.to_string_lossy().to_string(),
            None => continue,
        };

        // Skip if filename doesn't look like a hash (64 hex chars)
        if file_name.len() != 64 || !file_name.chars().all(|c| c.is_ascii_hexdigit()) {
            continue;
        }

        match process_file_for_scan(&conn, path, &file_name) {
            Ok(is_new) => {
                if is_new {
                    added += 1;
                } else {
                    updated += 1;
                }
            }
            Err(e) => {
                errors.push(format!("Error processing {}: {}", path.display(), e));
            }
        }
    }

    Ok(ScanResult {
        added,
        updated,
        deleted: 0, // TODO: Track deleted files
        errors,
    })
}

fn process_file_for_scan(conn: &rusqlite::Connection, path: &Path, hash: &str) -> Result<bool> {
    // Check if already in database
    let exists = get_blob_by_hash(conn, hash)?.is_some();

    // Get file metadata
    let metadata = fs::metadata(path)?;
    let mtime_ms = metadata
        .modified()?
        .duration_since(std::time::UNIX_EPOCH)?
        .as_millis() as i64;

    let mime = get_mime_type(path);

    // Insert or update
    insert_blob(
        conn,
        hash,
        metadata.len() as i64,
        &mime,
        mtime_ms,
        None, // No original filename during scan
    )?;

    insert_path(conn, hash, path.to_str().unwrap())?;

    Ok(!exists)
}

/// Health check for blob storage
#[tauri::command]
pub async fn health_check() -> Result<HealthReport, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    get_stats(&conn).map_err(|e| e.to_string())
}

/// Get blob storage statistics
#[tauri::command]
pub async fn get_blob_stats() -> Result<serde_json::Value, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let stats = get_stats(&conn).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "totalBlobs": stats.total_blobs,
        "totalSize": stats.total_size,
        "byMimeType": {} // TODO: Implement MIME type breakdown
    }))
}
