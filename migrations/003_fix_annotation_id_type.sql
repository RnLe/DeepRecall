-- Migration 003: Fix annotation ID type from UUID to TEXT
-- Annotations use deterministic SHA-256 hashes as IDs, not UUIDs

BEGIN;

-- Drop dependent tables first (cards references annotations)
DROP TABLE IF EXISTS review_logs CASCADE;
DROP TABLE IF EXISTS cards CASCADE;
DROP TABLE IF EXISTS annotations CASCADE;

-- Recreate annotations with TEXT id
CREATE TABLE annotations (
    id TEXT PRIMARY KEY, -- Changed from UUID to TEXT for SHA-256 hash IDs
    kind TEXT NOT NULL DEFAULT 'annotation' CHECK (kind = 'annotation'),
    
    -- Reference to PDF blob
    sha256 TEXT NOT NULL,
    page INTEGER NOT NULL,
    
    -- Annotation type
    type TEXT NOT NULL, -- 'highlight', 'note', 'drawing', 'underline', etc.
    
    -- Geometry and styling (JSON)
    geometry JSONB NOT NULL,
    style JSONB,
    
    -- Content
    content TEXT,
    
    -- Attached assets (array of asset IDs)
    attached_assets UUID[] DEFAULT '{}',
    
    -- Flexible metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_annotations_sha256 ON annotations(sha256);
CREATE INDEX idx_annotations_sha256_page ON annotations(sha256, page);
CREATE INDEX idx_annotations_type ON annotations(type);
CREATE INDEX idx_annotations_created_at ON annotations(created_at);
CREATE INDEX idx_annotations_updated_at ON annotations(updated_at);

-- Recreate cards with TEXT annotation_id to match annotations.id
CREATE TABLE cards (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'card' CHECK (kind = 'card'),
    
    -- Reference to annotation (changed to TEXT to match annotations.id)
    annotation_id TEXT NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
    
    -- Reference to PDF blob
    sha256 TEXT NOT NULL,
    
    -- SRS state (JSON with FSRS parameters)
    state JSONB NOT NULL,
    
    -- Due date (ISO 8601)
    due TEXT NOT NULL,
    
    -- Flexible metadata
    metadata JSONB,
    
    -- Timestamp
    created_ms BIGINT NOT NULL
);

CREATE INDEX idx_cards_annotation_id ON cards(annotation_id);
CREATE INDEX idx_cards_sha256 ON cards(sha256);
CREATE INDEX idx_cards_due ON cards(due);
CREATE INDEX idx_cards_state ON cards USING GIN(state);
CREATE INDEX idx_cards_created_ms ON cards(created_ms);

-- Recreate review_logs
CREATE TABLE review_logs (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'review_log' CHECK (kind = 'review_log'),
    
    -- Reference to card
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    
    -- Review details (JSON with rating, time, etc.)
    review_data JSONB NOT NULL,
    
    -- Timestamp
    review_ms BIGINT NOT NULL
);

CREATE INDEX idx_review_logs_card_id ON review_logs(card_id);
CREATE INDEX idx_review_logs_review_ms ON review_logs(review_ms);

COMMIT;

