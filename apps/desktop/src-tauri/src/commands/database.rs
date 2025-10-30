/**
 * Database Write Operations
 * 
 * Handles direct Postgres writes for desktop app independence.
 * Replaces web API /api/writes/batch endpoint.
 * 
 * Key Features:
 * - Direct tokio-postgres connection (no HTTP dependency)
 * - Type-safe parameter conversion (UUID, JSONB, arrays)
 * - LWW conflict resolution for updates
 * - Annotation schema transformation
 * - SSL support for cloud databases (Neon, etc.)
 */

use anyhow::Result;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use postgres_types::Json;
use tokio_postgres::Client;
use tokio_postgres_rustls::MakeRustlsConnect;
use rustls::ClientConfig;

/**
 * Get Postgres configuration from environment variables
 * Tries runtime env vars first, then falls back to compile-time bundled values
 */
fn get_pg_config() -> (String, u16, String, String, String, bool) {
    let host = env::var("VITE_POSTGRES_HOST")
        .or_else(|_| option_env!("VITE_POSTGRES_HOST").map(String::from).ok_or(()))
        .unwrap_or_else(|_| "localhost".to_string());
    
    let port = env::var("VITE_POSTGRES_PORT")
        .or_else(|_| option_env!("VITE_POSTGRES_PORT").map(String::from).ok_or(()))
        .unwrap_or_else(|_| "5432".to_string())
        .parse()
        .unwrap_or(5432);
    
    let user = env::var("VITE_POSTGRES_USER")
        .or_else(|_| option_env!("VITE_POSTGRES_USER").map(String::from).ok_or(()))
        .unwrap_or_else(|_| "deeprecall".to_string());
    
    let password = env::var("VITE_POSTGRES_PASSWORD")
        .or_else(|_| option_env!("VITE_POSTGRES_PASSWORD").map(String::from).ok_or(()))
        .unwrap_or_else(|_| "deeprecall".to_string());
    
    let database = env::var("VITE_POSTGRES_DB")
        .or_else(|_| option_env!("VITE_POSTGRES_DB").map(String::from).ok_or(()))
        .unwrap_or_else(|_| "deeprecall".to_string());
    
    let ssl = env::var("VITE_POSTGRES_SSL")
        .or_else(|_| option_env!("VITE_POSTGRES_SSL").map(String::from).ok_or(()))
        .unwrap_or_else(|_| "disable".to_string()) == "require";
    
    (host, port, user, password, database, ssl)
}

/**
 * Create a new Postgres client connection with SSL support
 */
async fn get_pg_client() -> Result<Client, String> {
    let (host, port, user, password, database, use_ssl) = get_pg_config();
    
    // Log connection details (without password)
    println!("[Database] Connecting to: {}:{}/{} (SSL: {})", host, port, database, use_ssl);
    
    if use_ssl {
        // SSL connection for cloud databases (Neon, etc.)
        let conn_str = format!(
            "host={} port={} user={} password={} dbname={} sslmode=require",
            host, port, user, password, database
        );
        
        let mut root_store = rustls::RootCertStore::empty();
        root_store.extend(
            webpki_roots::TLS_SERVER_ROOTS
                .iter()
                .cloned(),
        );
        
        let config = ClientConfig::builder()
            .with_root_certificates(root_store)
            .with_no_client_auth();
        
        let tls = MakeRustlsConnect::new(config);
        
        let (client, connection) = tokio_postgres::connect(&conn_str, tls)
            .await
            .map_err(|e| format!("Failed to connect to Postgres (SSL): {}", e))?;
        
        // Spawn connection handler
        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("Postgres connection error: {}", e);
            }
        });
        
        Ok(client)
    } else {
        // No SSL for local development
        let conn_str = format!(
            "host={} port={} user={} password={} dbname={}",
            host, port, user, password, database
        );
        
        let (client, connection) = tokio_postgres::connect(&conn_str, tokio_postgres::NoTls)
            .await
            .map_err(|e| format!("Failed to connect to Postgres: {}", e))?;
        
        // Spawn connection handler
        tokio::spawn(async move {
            if let Err(e) = connection.await {
                eprintln!("Postgres connection error: {}", e);
            }
        });
        
        Ok(client)
    }
}

/**
 * Write operation types
 */
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum WriteOperation {
    Insert,
    Update,
    Delete,
}

/**
 * Write change from client
 */
#[derive(Debug, Deserialize, Serialize)]
pub struct WriteChange {
    pub id: String,
    pub table: String,
    pub op: WriteOperation,
    pub payload: Value,
    pub created_at: i64,
    pub status: String,
    pub retry_count: i32,
}

/**
 * Result of applying a write
 */
#[derive(Debug, Serialize)]
pub struct WriteResult {
    pub id: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// JSONB columns that need special handling
lazy_static! {
    static ref JSONB_COLUMNS: std::collections::HashSet<&'static str> = {
        let mut set = std::collections::HashSet::new();
        set.insert("core_field_config");
        set.insert("custom_fields");
        set.insert("metadata");
        set.insert("authors");
        set.insert("geometry");
        set.insert("style");
        set.insert("avatar_crop_region");
        set.insert("points");
        set.insert("bounding_box");
        set
    };
}

/**
 * Convert camelCase to snake_case
 */
fn to_snake_case(s: &str) -> String {
    let mut result = String::new();
    for (i, ch) in s.chars().enumerate() {
        if ch.is_uppercase() {
            if i > 0 {
                result.push('_');
            }
            result.push(ch.to_lowercase().next().unwrap());
        } else {
            result.push(ch);
        }
    }
    result
}

/**
 * Convert object keys to snake_case and prepare values for Postgres
 */
fn keys_to_snake_case(obj: &Value) -> Result<HashMap<String, Value>, String> {
    let mut result = HashMap::new();
    
    if let Value::Object(map) = obj {
        for (key, value) in map {
            let snake_key = to_snake_case(key);
            
            // Handle JSONB columns - ensure they're JSON strings
            if JSONB_COLUMNS.contains(snake_key.as_str()) {
                if value.is_null() {
                    result.insert(snake_key, Value::Null);
                } else if value.is_object() || value.is_array() {
                    // Already a JSON value, serialize to string for Postgres
                    result.insert(snake_key, value.clone());
                } else {
                    result.insert(snake_key, value.clone());
                }
            } else {
                result.insert(snake_key, value.clone());
            }
        }
        Ok(result)
    } else {
        Err("Payload must be an object".to_string())
    }
}

/**
 * Transform annotation data from client schema to Postgres schema
 */
fn transform_annotation_data(validated: &Value) -> Result<Value, String> {
    if let Value::Object(map) = validated {
        let mut result = map.clone();
        
        // Extract data field
        if let Some(data) = map.get("data") {
            if let Value::Object(data_map) = data {
                // Set kind
                result.insert("kind".to_string(), Value::String("annotation".to_string()));
                
                // Set type
                if let Some(type_val) = data_map.get("type") {
                    result.insert("type".to_string(), type_val.clone());
                }
                
                // Build geometry
                if let Some(type_str) = data_map.get("type").and_then(|v| v.as_str()) {
                    let geometry = if type_str == "rectangle" {
                        if let Some(rects) = data_map.get("rects") {
                            serde_json::json!({ "rects": rects })
                        } else {
                            Value::Null
                        }
                    } else {
                        if let Some(ranges) = data_map.get("ranges") {
                            serde_json::json!({ "ranges": ranges })
                        } else {
                            Value::Null
                        }
                    };
                    result.insert("geometry".to_string(), geometry);
                }
            }
            result.remove("data");
        }
        
        // Extract metadata field
        if let Some(metadata) = map.get("metadata") {
            if let Value::Object(meta_map) = metadata {
                // Build style from color
                if let Some(color) = meta_map.get("color") {
                    result.insert("style".to_string(), serde_json::json!({ "color": color }));
                }
                
                // Extract content from notes
                if let Some(notes) = meta_map.get("notes") {
                    result.insert("content".to_string(), notes.clone());
                }
                
                // Extract attached assets
                if let Some(attached) = meta_map.get("attachedAssets") {
                    result.insert("attachedAssets".to_string(), attached.clone());
                }
                
                // Build metadata JSONB
                let mut pg_metadata = serde_json::Map::new();
                if let Some(title) = meta_map.get("title") {
                    pg_metadata.insert("title".to_string(), title.clone());
                }
                if let Some(kind) = meta_map.get("kind") {
                    pg_metadata.insert("kind".to_string(), kind.clone());
                }
                if let Some(tags) = meta_map.get("tags") {
                    pg_metadata.insert("tags".to_string(), tags.clone());
                }
                if let Some(note_groups) = meta_map.get("noteGroups") {
                    pg_metadata.insert("noteGroups".to_string(), note_groups.clone());
                }
                
                if !pg_metadata.is_empty() {
                    result.insert("metadata".to_string(), Value::Object(pg_metadata));
                }
            }
            result.remove("metadata");
        }
        
        Ok(Value::Object(result))
    } else {
        Err("Validated payload must be an object".to_string())
    }
}

/**
 * Convert Postgres row to JSON object
 * Handles different column types properly
 */
fn row_to_json(row: &tokio_postgres::Row) -> Value {
    use tokio_postgres::types::Type;
    
    let mut result = serde_json::Map::new();
    
    for (i, column) in row.columns().iter().enumerate() {
        let column_name = column.name().to_string();
        let column_type = column.type_();
        
        let value = match *column_type {
            Type::UUID => {
                let uuid_val: Option<uuid::Uuid> = row.get(i);
                uuid_val.map(|u| Value::String(u.to_string())).unwrap_or(Value::Null)
            }
            Type::TEXT | Type::VARCHAR | Type::BPCHAR => {
                let str_val: Option<String> = row.get(i);
                str_val.map(Value::String).unwrap_or(Value::Null)
            }
            Type::INT2 | Type::INT4 => {
                let int_val: Option<i32> = row.get(i);
                int_val.map(|n| Value::Number(n.into())).unwrap_or(Value::Null)
            }
            Type::INT8 => {
                let int_val: Option<i64> = row.get(i);
                int_val.map(|n| Value::Number(n.into())).unwrap_or(Value::Null)
            }
            Type::BOOL => {
                let bool_val: Option<bool> = row.get(i);
                bool_val.map(Value::Bool).unwrap_or(Value::Null)
            }
            Type::JSONB | Type::JSON => {
                let json_val: Option<serde_json::Value> = row.get(i);
                json_val.unwrap_or(Value::Null)
            }
            Type::TEXT_ARRAY | Type::VARCHAR_ARRAY => {
                let arr_val: Option<Vec<String>> = row.get(i);
                arr_val.map(|arr| Value::Array(arr.into_iter().map(Value::String).collect()))
                    .unwrap_or(Value::Null)
            }
            Type::UUID_ARRAY => {
                let arr_val: Option<Vec<uuid::Uuid>> = row.get(i);
                arr_val.map(|arr| Value::Array(arr.into_iter().map(|u| Value::String(u.to_string())).collect()))
                    .unwrap_or(Value::Null)
            }
            Type::FLOAT4 | Type::FLOAT8 => {
                let float_val: Option<f64> = row.get(i);
                float_val.and_then(|f| serde_json::Number::from_f64(f).map(Value::Number))
                    .unwrap_or(Value::Null)
            }
            _ => {
                // Fallback: try as string
                let str_val: Option<String> = row.get(i);
                str_val.map(Value::String).unwrap_or(Value::Null)
            }
        };
        
        result.insert(column_name, value);
    }
    
    Value::Object(result)
}

/**
 * Convert JSON value to typed Postgres parameter
 * Handles: UUID, UUID[], text[], JSONB, integers, booleans, strings
 */
fn json_to_param(
    _table: &str,
    column: &str,
    value: &Value,
) -> Box<dyn tokio_postgres::types::ToSql + Sync + Send> {

    match value {
        Value::Null => {
            if column.ends_with("_id") || column == "id" {
                Box::new(Option::<uuid::Uuid>::None)
            } else if column.ends_with("_ids") {
                Box::new(Option::<Vec<uuid::Uuid>>::None)
            } else {
                Box::new(Option::<String>::None)
            }
        }
        Value::Bool(b) => Box::new(*b),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Box::new(i)
            } else if let Some(u) = n.as_u64() {
                // Postgres does not support u64 directly; cast to i64 (values should be safe)
                Box::new(u as i64)
            } else if let Some(f) = n.as_f64() {
                Box::new(f)
            } else {
                Box::new(Option::<f64>::None)
            }
        }
        Value::String(s) => {
            if column.ends_with("_id") || column == "id" {
                match uuid::Uuid::parse_str(s) {
                    Ok(uuid) => Box::new(uuid),
                    Err(_) => Box::new(s.clone()),
                }
            } else {
                Box::new(s.clone())
            }
        }
        Value::Array(arr) => {
            // All string elements => text[] or uuid[]
            if arr.iter().all(|v| v.is_string()) {
                let strings: Vec<String> = arr
                    .iter()
                    .map(|v| v.as_str().unwrap().to_string())
                    .collect();
                if column.ends_with("_ids") {
                    let uuids: Vec<uuid::Uuid> = strings
                        .iter()
                        .filter_map(|s| uuid::Uuid::parse_str(s).ok())
                        .collect();
                    if uuids.len() == strings.len() {
                        Box::new(uuids)
                    } else {
                        Box::new(strings)
                    }
                } else {
                    Box::new(strings)
                }
            } else if arr.is_empty() {
                Box::new(Vec::<String>::new())
            } else {
                // Mixed content -> store as JSON
                Box::new(Json(value.clone()))
            }
        }
        Value::Object(_) => Box::new(Json(value.clone())),
    }
}

/**
 * Apply insert operation
 */
async fn apply_insert(client: &Client, change: &WriteChange) -> Result<Value, String> {
    let transformed = if change.table == "annotations" {
        transform_annotation_data(&change.payload)?
    } else {
        change.payload.clone()
    };
    
    let data = keys_to_snake_case(&transformed)?;
    
    let columns: Vec<String> = data.keys().cloned().collect();
    let placeholders: Vec<String> = (1..=columns.len()).map(|i| format!("${}", i)).collect();
    
    // Build query with appropriate conflict handling
    let query = if change.table == "blobs_meta" {
        // blobs_meta: unique on sha256, use DO NOTHING for idempotency
        format!(
            "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT (sha256) DO NOTHING RETURNING *",
            change.table,
            columns.join(", "),
            placeholders.join(", ")
        )
    } else if change.table == "device_blobs" {
        // device_blobs: unique on (device_id, sha256), use DO NOTHING for idempotency
        format!(
            "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT (device_id, sha256) DO NOTHING RETURNING *",
            change.table,
            columns.join(", "),
            placeholders.join(", ")
        )
    } else {
        // Other tables: update on conflict (LWW)
        format!(
            "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT (id) DO UPDATE SET {} RETURNING *",
            change.table,
            columns.join(", "),
            placeholders.join(", "),
            columns.iter().enumerate()
                .map(|(i, col)| format!("{} = ${}", col, i + 1))
                .collect::<Vec<_>>()
                .join(", ")
        )
    };
    
    // Convert JSON values to Postgres parameters
    let param_values: Vec<Box<dyn tokio_postgres::types::ToSql + Sync + Send>> = columns
        .iter()
        .map(|col| {
            let val = data.get(col).unwrap();
            json_to_param(&change.table, col, val)
        })
        .collect();

    // Build parameter references
    let params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = param_values
        .iter()
        .map(|p| &**p as &(dyn tokio_postgres::types::ToSql + Sync))
        .collect();
    
    // Use query() instead of query_one() to handle DO NOTHING case (returns 0 rows)
    let rows = client.query(&query, &params[..])
        .await
        .map_err(|e| format!("Insert failed: {}", e))?;
    
    // If DO NOTHING was used and nothing was inserted, return null
    // (This is not an error - just means the record already existed)
    if let Some(row) = rows.first() {
        Ok(row_to_json(row))
    } else {
        Ok(Value::Null)
    }
}

/**
 * Apply update operation with LWW conflict resolution
 */
async fn apply_update(client: &Client, change: &WriteChange) -> Result<Value, String> {
    let transformed = if change.table == "annotations" {
        transform_annotation_data(&change.payload)?
    } else {
        change.payload.clone()
    };
    
    let data = keys_to_snake_case(&transformed)?;
    
    // Get ID
    let id = data.get("id")
        .and_then(|v| v.as_str())
        .ok_or("Missing id in update payload")?;
    
    // Check if record exists
    let check_query = format!("SELECT updated_at FROM {} WHERE id = $1", change.table);
    let existing = client.query_opt(&check_query, &[&id]).await
        .map_err(|e| format!("Failed to check existing record: {}", e))?;
    
    if existing.is_none() {
        // Record doesn't exist, treat as insert
        return apply_insert(client, change).await;
    }
    
    // LWW: compare timestamps
    let server_updated_at: i64 = existing.unwrap().get(0);
    let client_updated_at = data.get("updated_at")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    
    if client_updated_at < server_updated_at {
        println!("[WritesBatch] Skipping update for {}/{} - server is newer", change.table, id);
        // Return existing record
        let fetch_query = format!("SELECT * FROM {} WHERE id = $1", change.table);
        let row = client.query_one(&fetch_query, &[&id]).await
            .map_err(|e| format!("Failed to fetch existing record: {}", e))?;
        
        let mut result = serde_json::Map::new();
        for (i, column) in row.columns().iter().enumerate() {
            let value: Option<String> = row.get(i);
            result.insert(
                column.name().to_string(),
                value.map(Value::String).unwrap_or(Value::Null)
            );
        }
        return Ok(Value::Object(result));
    }
    
    // Build UPDATE query
    let columns: Vec<String> = data.keys()
        .filter(|k| *k != "id")
        .cloned()
        .collect();
    
    let set_clause: Vec<String> = columns.iter().enumerate()
        .map(|(i, col)| format!("{} = ${}", col, i + 2))
        .collect();
    
    let query = format!(
        "UPDATE {} SET {} WHERE id = $1 RETURNING *",
        change.table,
        set_clause.join(", ")
    );
    
    // Convert JSON values to Postgres parameters (id first)
    let mut param_values: Vec<Box<dyn tokio_postgres::types::ToSql + Sync + Send>> = Vec::new();
    param_values.push(Box::new(id.to_string()));
    for col in &columns {
        let val = data.get(col).unwrap();
        param_values.push(json_to_param(&change.table, col, val));
    }

    let params: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = param_values
        .iter()
        .map(|p| &**p as &(dyn tokio_postgres::types::ToSql + Sync))
        .collect();
    
    let row = client.query_one(&query, &params[..])
        .await
        .map_err(|e| format!("Update failed: {}", e))?;
    
    // Convert row to JSON using type-aware helper
    Ok(row_to_json(&row))
}

/**
 * Apply delete operation
 */
async fn apply_delete(client: &Client, change: &WriteChange) -> Result<Value, String> {
    let id_str = change.payload.get("id")
        .and_then(|v| v.as_str())
        .ok_or("Missing id in delete payload")?;
    
    let query = format!("DELETE FROM {} WHERE id = $1 RETURNING *", change.table);
    
    // Parse ID as UUID for proper type handling
    let id_uuid = uuid::Uuid::parse_str(id_str)
        .map_err(|e| format!("Invalid UUID format: {}", e))?;

    let row = client.query_opt(&query, &[&id_uuid])
        .await
        .map_err(|e| format!("Delete failed: {}", e))?;
    
    if let Some(row) = row {
        // Convert row to JSON using type-aware helper
        Ok(row_to_json(&row))
    } else {
        Ok(Value::Null)
    }
}

/**
 * Flush writes - apply batched write changes to Postgres
 */
#[tauri::command]
pub async fn flush_writes(changes: Vec<WriteChange>) -> Result<Vec<WriteResult>, String> {
    println!("[FlushWrites] Starting flush of {} changes", changes.len());
    
    let client = get_pg_client().await?;
    
    let mut results = Vec::new();
    
    for change in changes {
        println!("[FlushWrites] Processing {} operation on table '{}' (id: {})", 
                 match change.op {
                     WriteOperation::Insert => "INSERT",
                     WriteOperation::Update => "UPDATE",
                     WriteOperation::Delete => "DELETE",
                 },
                 change.table,
                 change.id);
        
        let result = match change.op {
            WriteOperation::Insert => apply_insert(&client, &change).await,
            WriteOperation::Update => apply_update(&client, &change).await,
            WriteOperation::Delete => apply_delete(&client, &change).await,
        };
        
        match &result {
            Ok(_) => println!("[FlushWrites] ✓ Success: {}", change.id),
            Err(e) => println!("[FlushWrites] ✗ Error: {} - {}", change.id, e),
        }
        
        results.push(match result {
            Ok(data) => WriteResult {
                id: change.id.clone(),
                success: true,
                data: Some(data),
                error: None,
            },
            Err(error) => WriteResult {
                id: change.id.clone(),
                success: false,
                data: None,
                error: Some(error),
            },
        });
    }
    
    let success_count = results.iter().filter(|r| r.success).count();
    let error_count = results.len() - success_count;
    println!("[FlushWrites] Completed: {} success, {} errors", success_count, error_count);
    
    Ok(results)
}

/// Clear all database tables (Postgres)
#[tauri::command]
pub async fn clear_all_database() -> Result<(), String> {
    let client = get_pg_client().await?;
    
    // List of tables to clear (in order to avoid FK constraint issues)
    let tables = vec![
        "review_logs",
        "cards",
        "annotations",
        "strokes",
        "boards",
        "edges",
        "device_blobs",
        "assets",
        "activities",
        "works",
        "collections",
        "authors",
        "presets",
        "replication_jobs",
        "blobs_meta",
    ];
    
    for table in tables {
        client.execute(&format!("DELETE FROM {}", table), &[])
            .await
            .map_err(|e| format!("Failed to clear table {}: {}", table, e))?;
        println!("[Database] Cleared table: {}", table);
    }
    
    Ok(())
}

/// Export all data to JSON
#[tauri::command]
pub async fn export_all_data() -> Result<String, String> {
    // TODO: Export all data from Dexie + Postgres
    // For MVP, this should:
    // 1. Export Dexie IndexedDB data (via frontend)
    // 2. Export Postgres data (via API or direct connection)
    
    println!("TODO: Implement full data export");
    
    // Placeholder return
    let export_data = serde_json::json!({
        "version": "1.0",
        "exportedAt": chrono::Utc::now().to_rfc3339(),
        "works": [],
        "assets": [],
        "annotations": [],
        "cards": [],
        "activities": [],
        "collections": [],
        "message": "Export not yet implemented"
    });
    
    serde_json::to_string_pretty(&export_data).map_err(|e| e.to_string())
}

/// Estimate export size
#[tauri::command]
pub async fn estimate_export_size() -> Result<i64, String> {
    // TODO: Calculate estimated size of export
    // For MVP, return placeholder
    
    println!("TODO: Implement export size estimation");
    Ok(0)
}

/// Import data from JSON
#[tauri::command]
pub async fn import_data(data: String) -> Result<(), String> {
    // TODO: Import data into Postgres
    // Parse JSON and insert into database tables
    
    let _parsed: Value = serde_json::from_str(&data).map_err(|e| e.to_string())?;
    
    println!("TODO: Implement data import");
    println!("Data preview: {} bytes", data.len());
    
    // For MVP, return success
    // In production, this should:
    // 1. Parse JSON
    // 2. Validate data structure
    // 3. Insert into Postgres with conflict resolution
    // 4. Trigger Electric sync
    
    Ok(())
}

/**
 * Query Postgres table for admin panel
 */
#[tauri::command]
pub async fn query_postgres_table(table: String) -> Result<Vec<Value>, String> {
    let client = get_pg_client().await?;
    
    // Validate table name (security: prevent SQL injection)
    let valid_tables = [
        "works", "assets", "activities", "collections", "edges", "presets",
        "authors", "annotations", "cards", "review_logs", "boards", "strokes",
        "blobs_meta", "device_blobs"
    ];
    
    if !valid_tables.contains(&table.as_str()) {
        return Err(format!("Invalid table name: {}", table));
    }
    
    // Query all rows from table
    // Try to order by created_at if it exists, otherwise just limit results
    let query = format!("SELECT * FROM {} LIMIT 100", table);
    let rows = client.query(&query, &[])
        .await
        .map_err(|e| format!("Query failed: {}", e))?;
    
    // Convert rows to JSON
    let results: Vec<Value> = rows
        .iter()
        .map(|row| row_to_json(row))
        .collect();
    
    Ok(results)
}

/// Query all Postgres tables at once (efficient for admin panel)
#[tauri::command]
pub async fn query_all_postgres_tables() -> Result<HashMap<String, Vec<Value>>, String> {
    use std::collections::HashMap;
    
    let client = get_pg_client().await?;
    
    let valid_tables = [
        "works", "assets", "activities", "collections", "edges", "presets",
        "authors", "annotations", "cards", "review_logs", "boards", "strokes",
        "blobs_meta", "device_blobs"
    ];
    
    let mut results = HashMap::new();
    
    for table in valid_tables.iter() {
        let query = format!("SELECT * FROM {} LIMIT 1000", table);
        match client.query(&query, &[]).await {
            Ok(rows) => {
                let table_data: Vec<Value> = rows
                    .iter()
                    .map(|row| row_to_json(row))
                    .collect();
                results.insert(table.to_string(), table_data);
            }
            Err(e) => {
                println!("Failed to query table {}: {}", table, e);
                results.insert(table.to_string(), vec![]);
            }
        }
    }
    
    Ok(results)
}
