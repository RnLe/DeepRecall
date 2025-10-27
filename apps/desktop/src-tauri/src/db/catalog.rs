/**
 * SQLite database connection and schema management
 */

use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use std::path::PathBuf;

pub fn get_db_path() -> Result<PathBuf> {
    let home_dir = dirs::home_dir().context("Failed to get home directory")?;
    let app_dir = home_dir.join("DeepRecall");
    std::fs::create_dir_all(&app_dir)?;
    Ok(app_dir.join("catalog.db"))
}

pub fn get_connection() -> Result<Connection> {
    let db_path = get_db_path()?;
    let conn = Connection::open(db_path)?;
    init_schema(&conn)?;
    Ok(conn)
}

fn init_schema(conn: &Connection) -> Result<()> {
    // Create blobs table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS blobs (
            hash TEXT PRIMARY KEY,
            size INTEGER NOT NULL,
            mime TEXT NOT NULL,
            mtime_ms INTEGER NOT NULL,
            created_ms INTEGER NOT NULL,
            filename TEXT,
            health TEXT DEFAULT 'healthy',
            image_width INTEGER,
            image_height INTEGER,
            line_count INTEGER
        )",
        [],
    )?;

    // Create paths table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS paths (
            hash TEXT NOT NULL,
            path TEXT NOT NULL PRIMARY KEY,
            FOREIGN KEY(hash) REFERENCES blobs(hash) ON DELETE CASCADE
        )",
        [],
    )?;

    // Create index on hash for paths table
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_paths_hash ON paths(hash)",
        [],
    )?;

    Ok(())
}

pub fn insert_blob(
    conn: &Connection,
    hash: &str,
    size: i64,
    mime: &str,
    mtime_ms: i64,
    filename: Option<&str>,
) -> Result<()> {
    let created_ms = chrono::Utc::now().timestamp_millis();

    conn.execute(
        "INSERT OR REPLACE INTO blobs (hash, size, mime, mtime_ms, created_ms, filename, health)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'healthy')",
        params![hash, size, mime, mtime_ms, created_ms, filename],
    )?;

    Ok(())
}

pub fn insert_path(conn: &Connection, hash: &str, path: &str) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO paths (hash, path) VALUES (?1, ?2)",
        params![hash, path],
    )?;

    Ok(())
}

pub fn get_blob_by_hash(conn: &Connection, hash: &str) -> Result<Option<super::types::BlobInfo>> {
    let mut stmt = conn.prepare(
        "SELECT b.hash, b.size, b.mime, b.mtime_ms, b.created_ms, b.filename, b.health, p.path
         FROM blobs b
         LEFT JOIN paths p ON b.hash = p.hash
         WHERE b.hash = ?1
         LIMIT 1",
    )?;

    let mut rows = stmt.query(params![hash])?;

    if let Some(row) = rows.next()? {
        Ok(Some(super::types::BlobInfo {
            sha256: row.get(0)?,
            size: row.get(1)?,
            mime: row.get(2)?,
            mtime_ms: row.get(3)?,
            created_ms: row.get(4)?,
            filename: row.get(5)?,
            health: row.get(6)?,
            path: row.get(7)?,
        }))
    } else {
        Ok(None)
    }
}

pub fn list_all_blobs(conn: &Connection) -> Result<Vec<super::types::BlobWithMetadata>> {
    let mut stmt = conn.prepare(
        "SELECT b.hash, b.size, b.mime, b.mtime_ms, b.created_ms, b.filename, b.health, 
                b.image_width, b.image_height, b.line_count, p.path
         FROM blobs b
         LEFT JOIN paths p ON b.hash = p.hash",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(super::types::BlobWithMetadata {
            sha256: row.get(0)?,
            size: row.get(1)?,
            mime: row.get(2)?,
            mtime_ms: row.get(3)?,
            created_ms: row.get(4)?,
            filename: row.get(5)?,
            health: row.get(6)?,
            image_width: row.get(7)?,
            image_height: row.get(8)?,
            line_count: row.get(9)?,
            path: row.get(10)?,
            page_count: None,
        })
    })?;

    let mut blobs = Vec::new();
    for blob in rows {
        blobs.push(blob?);
    }

    Ok(blobs)
}

pub fn delete_blob(conn: &Connection, hash: &str) -> Result<()> {
    conn.execute("DELETE FROM paths WHERE hash = ?1", params![hash])?;
    conn.execute("DELETE FROM blobs WHERE hash = ?1", params![hash])?;
    Ok(())
}

pub fn update_filename(conn: &Connection, hash: &str, filename: &str) -> Result<()> {
    conn.execute(
        "UPDATE blobs SET filename = ?1 WHERE hash = ?2",
        params![filename, hash],
    )?;
    Ok(())
}

pub fn get_stats(conn: &Connection) -> Result<super::types::HealthReport> {
    let total_blobs: i32 = conn.query_row("SELECT COUNT(*) FROM blobs", [], |row| row.get(0))?;

    let healthy: i32 = conn.query_row(
        "SELECT COUNT(*) FROM blobs WHERE health = 'healthy'",
        [],
        |row| row.get(0),
    )?;

    let missing: i32 = conn.query_row(
        "SELECT COUNT(*) FROM blobs WHERE health = 'missing'",
        [],
        |row| row.get(0),
    )?;

    let modified: i32 = conn.query_row(
        "SELECT COUNT(*) FROM blobs WHERE health = 'modified'",
        [],
        |row| row.get(0),
    )?;

    let relocated: i32 = conn.query_row(
        "SELECT COUNT(*) FROM blobs WHERE health = 'relocated'",
        [],
        |row| row.get(0),
    )?;

    let total_size: i64 = conn.query_row(
        "SELECT COALESCE(SUM(size), 0) FROM blobs",
        [],
        |row| row.get(0),
    )?;

    Ok(super::types::HealthReport {
        total_blobs,
        healthy,
        missing,
        modified,
        relocated,
        total_size,
    })
}
