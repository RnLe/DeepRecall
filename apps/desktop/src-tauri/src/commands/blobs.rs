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

    // Store file with hash + extension as name (for MIME type detection)
    // Extract extension from original filename
    let extension = std::path::Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    let filename_on_disk = if extension.is_empty() {
        hash.clone()
    } else {
        format!("{}.{}", hash, extension)
    };
    let file_path = subdir.join(&filename_on_disk);
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

/// Delete a blob (database entry only, keeps file on disk)
#[tauri::command]
pub async fn delete_blob(sha256: String) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    // Delete from database only - DO NOT delete the actual file
    // Files are content-addressed and may be referenced elsewhere
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
    // Check if already in database and get existing filename
    let existing_blob = get_blob_by_hash(conn, hash)?;
    let existing_filename = existing_blob.as_ref().and_then(|b| b.filename.clone());

    // Get file metadata
    let metadata = fs::metadata(path)?;
    let mtime_ms = metadata
        .modified()?
        .duration_since(std::time::UNIX_EPOCH)?
        .as_millis() as i64;

    // Try to detect MIME from filename first (if available), then fallback to path
    let mime = if let Some(ref filename) = existing_filename {
        mime_guess::from_path(filename)
            .first_or_octet_stream()
            .to_string()
    } else {
        get_mime_type(path)
    };

    // Insert or update (preserve existing filename if available)
    insert_blob(
        conn,
        hash,
        metadata.len() as i64,
        &mime,
        mtime_ms,
        existing_filename.as_deref(), // Preserve filename if it exists
    )?;

    insert_path(conn, hash, path.to_str().unwrap())?;

    Ok(existing_blob.is_none())
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

/// Read blob file content as string
#[tauri::command]
pub async fn read_blob(sha256: String) -> Result<String, String> {
    let blobs_dir = get_blobs_dir().map_err(|e| e.to_string())?;
    let prefix = &sha256[0..2];
    let blob_path = blobs_dir.join(prefix).join(&sha256);

    if !blob_path.exists() {
        return Err(format!("Blob not found: {}", sha256));
    }

    fs::read_to_string(blob_path).map_err(|e| e.to_string())
}

/// Sync blob metadata to Electric (Postgres)
#[tauri::command]
pub async fn sync_blob_to_electric(sha256: String, device_id: String) -> Result<(), String> {
    use tokio_postgres::NoTls;
    
    // Get blob info from SQLite catalog
    let conn = get_connection().map_err(|e| e.to_string())?;
    let blob = get_blob_by_hash(&conn, &sha256)
        .map_err(|e| format!("Failed to get blob: {}", e))?
        .ok_or_else(|| format!("Blob not found: {}", sha256))?;

    // Connect to Postgres
    let pg_conn_str = "host=localhost port=5432 user=deeprecall password=deeprecall dbname=deeprecall";
    let (client, connection) = tokio_postgres::connect(pg_conn_str, NoTls)
        .await
        .map_err(|e| format!("Failed to connect to Postgres: {}", e))?;
    
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("Postgres connection error: {}", e);
        }
    });

    // Generate UUIDs for new records
    let device_blob_id = uuid::Uuid::new_v4(); // Keep as UUID type
    
    let now_ms = chrono::Utc::now().timestamp_millis();

    // Insert into blobs_meta (if not exists)
    // Note: blobs_meta uses sha256 as primary key, no separate id column
    let meta_query = r#"
        INSERT INTO blobs_meta (sha256, size, mime, filename, created_ms)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (sha256) DO NOTHING
    "#;
    
    client.execute(
        meta_query,
        &[&sha256, &(blob.size as i64), &blob.mime, &blob.filename, &now_ms]
    ).await.map_err(|e| format!("Failed to insert blobs_meta: {}", e))?;

    // Insert into device_blobs (if not exists, update if exists)
    let device_query = r#"
        INSERT INTO device_blobs (id, device_id, sha256, present, health, created_ms)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (device_id, sha256) DO UPDATE SET
            present = EXCLUDED.present,
            health = EXCLUDED.health
    "#;
    
    client.execute(
        device_query,
        &[&device_blob_id, &device_id, &sha256, &true, &"healthy", &now_ms]
    ).await.map_err(|e| format!("Failed to insert device_blobs: {}", e))?;

    println!("✅ Synced blob {} to Electric", sha256);
    
    Ok(())
}

/// Clear all blobs from disk
#[tauri::command]
pub async fn clear_all_blobs() -> Result<(), String> {
    let blobs_dir = get_blobs_dir().map_err(|e| e.to_string())?;
    
    if blobs_dir.exists() {
        fs::remove_dir_all(&blobs_dir).map_err(|e| e.to_string())?;
        fs::create_dir_all(&blobs_dir).map_err(|e| e.to_string())?;
    }

    // Also clear the SQLite catalog
    let conn = get_connection().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM blobs", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM paths", [])
        .map_err(|e| e.to_string())?;

    Ok(())
}
