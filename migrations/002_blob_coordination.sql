-- Blob Coordination Tables for Multi-Device Sync
-- These tables coordinate blob presence across devices without storing actual file bytes
-- Blob files remain platform-local (Web: server, Desktop: local, Mobile: sandboxed)

-- ============================================================================
-- Blobs Metadata table
-- Authoritative source of truth for blob metadata across all devices
-- ============================================================================
CREATE TABLE blobs_meta (
    -- Content-addressed primary key (SHA-256 hash)
    sha256 TEXT PRIMARY KEY,
    
    -- File metadata
    size BIGINT NOT NULL,
    mime TEXT NOT NULL,
    
    -- Optional filename (may differ per device, but we store a canonical one)
    filename TEXT,
    
    -- Creation timestamp (epoch ms)
    created_ms BIGINT NOT NULL,
    
    -- Optional metadata extracted from file
    -- PDF-specific
    page_count INTEGER,
    pdf_metadata JSONB,
    
    -- Image-specific
    image_width INTEGER,
    image_height INTEGER,
    
    -- Text-specific
    line_count INTEGER
);

CREATE INDEX idx_blobs_meta_mime ON blobs_meta(mime);
CREATE INDEX idx_blobs_meta_created_ms ON blobs_meta(created_ms);

-- ============================================================================
-- Device Blobs table
-- Tracks which device has which blob (presence tracking)
-- ============================================================================
CREATE TABLE device_blobs (
    id UUID PRIMARY KEY,
    
    -- Device identifier (generated per-device, stored in local storage)
    device_id TEXT NOT NULL,
    
    -- Reference to blob
    sha256 TEXT NOT NULL REFERENCES blobs_meta(sha256) ON DELETE CASCADE,
    
    -- Presence flag (does this device have this blob?)
    present BOOLEAN NOT NULL DEFAULT false,
    
    -- Local path on this device (platform-specific, optional)
    local_path TEXT,
    
    -- Last modified timestamp on this device (ISO 8601)
    mtime_ms BIGINT,
    
    -- Health status on this device
    health TEXT CHECK (health IN ('healthy', 'missing', 'modified', 'relocated')),
    
    -- Error message if health check failed
    error TEXT,
    
    -- Timestamps (epoch ms)
    created_ms BIGINT NOT NULL,
    
    -- Ensure one entry per device per blob
    UNIQUE(device_id, sha256)
);

CREATE INDEX idx_device_blobs_device_id ON device_blobs(device_id);
CREATE INDEX idx_device_blobs_sha256 ON device_blobs(sha256);
CREATE INDEX idx_device_blobs_present ON device_blobs(present) WHERE present = true;

-- ============================================================================
-- Replication Jobs table
-- Manages blob sync tasks between devices or cloud storage
-- ============================================================================
CREATE TABLE replication_jobs (
    id UUID PRIMARY KEY,
    
    -- Blob to replicate
    sha256 TEXT NOT NULL REFERENCES blobs_meta(sha256) ON DELETE CASCADE,
    
    -- Source (device_id or 'cloud')
    from_source TEXT,
    
    -- Destination (device_id or 'cloud')
    to_destination TEXT NOT NULL,
    
    -- Job status
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
    
    -- Progress (0-100)
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    
    -- Bytes transferred
    bytes_transferred BIGINT DEFAULT 0,
    
    -- Error message if failed
    error TEXT,
    
    -- Priority (higher = more important)
    priority INTEGER DEFAULT 0,
    
    -- Timestamps (epoch ms)
    created_ms BIGINT NOT NULL,
    started_ms BIGINT,
    completed_ms BIGINT
);

CREATE INDEX idx_replication_jobs_sha256 ON replication_jobs(sha256);
CREATE INDEX idx_replication_jobs_status ON replication_jobs(status);
CREATE INDEX idx_replication_jobs_destination ON replication_jobs(to_destination);
CREATE INDEX idx_replication_jobs_priority ON replication_jobs(priority DESC);

-- Note: Electric SQL will automatically sync these tables in "direct_writes" mode

