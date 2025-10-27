/**
 * Database types and models for blob storage
 */

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlobInfo {
    pub sha256: String,
    pub filename: Option<String>,
    pub size: i64,
    pub mime: String,
    pub created_ms: i64,
    pub mtime_ms: i64,
    pub path: Option<String>,
    pub health: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlobWithMetadata {
    pub sha256: String,
    pub filename: Option<String>,
    pub size: i64,
    pub mime: String,
    pub created_ms: i64,
    pub mtime_ms: i64,
    pub path: Option<String>,
    pub health: Option<String>,
    // PDF-specific
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_count: Option<i32>,
    // Image-specific
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_width: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_height: Option<i32>,
    // Text file-specific
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_count: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub added: i32,
    pub updated: i32,
    pub deleted: i32,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthReport {
    pub total_blobs: i32,
    pub healthy: i32,
    pub missing: i32,
    pub modified: i32,
    pub relocated: i32,
    pub total_size: i64,
}

impl From<BlobInfo> for BlobWithMetadata {
    fn from(info: BlobInfo) -> Self {
        BlobWithMetadata {
            sha256: info.sha256,
            filename: info.filename,
            size: info.size,
            mime: info.mime,
            created_ms: info.created_ms,
            mtime_ms: info.mtime_ms,
            path: info.path,
            health: info.health,
            page_count: None,
            image_width: None,
            image_height: None,
            line_count: None,
        }
    }
}
