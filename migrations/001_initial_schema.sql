-- DeepRecall Initial Schema
-- Mirrors Dexie v7 schema for ElectricSQL sync
-- All tables use UUID primary keys (client-generated)
-- Timestamps use ISO 8601 strings for compatibility with Dexie

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Authors table
-- ============================================================================
CREATE TABLE authors (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'author' CHECK (kind = 'author'),
    
    -- Name components
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    middle_name TEXT,
    
    -- Optional titles (array for multiple)
    titles TEXT[],
    
    -- Professional info
    affiliation TEXT,
    contact TEXT,
    orcid TEXT,
    website TEXT,
    bio TEXT,
    
    -- Avatar paths and crop region (JSON)
    avatar_original_path TEXT,
    avatar_display_path TEXT,
    avatar_crop_region JSONB,
    
    -- Timestamps (ISO 8601 strings)
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_authors_last_name ON authors(last_name);
CREATE INDEX idx_authors_first_name ON authors(first_name);
CREATE INDEX idx_authors_orcid ON authors(orcid) WHERE orcid IS NOT NULL;

-- ============================================================================
-- Works table (papers, books, notes, etc.)
-- ============================================================================
CREATE TABLE works (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'work' CHECK (kind = 'work'),
    
    -- Core identity
    title TEXT NOT NULL,
    subtitle TEXT,
    work_type TEXT NOT NULL DEFAULT 'paper',
    
    -- Author references (array of UUIDs)
    author_ids UUID[] DEFAULT '{}',
    
    -- LEGACY: Keep for backward compatibility
    authors JSONB,
    
    -- Topics/tags
    topics TEXT[] DEFAULT '{}',
    
    -- Multiple assets flag
    allow_multiple_assets BOOLEAN NOT NULL DEFAULT false,
    
    -- Publication metadata
    year INTEGER,
    publishing_date TEXT,
    publisher TEXT,
    journal TEXT,
    volume TEXT,
    issue TEXT,
    pages TEXT,
    doi TEXT,
    arxiv_id TEXT,
    isbn TEXT,
    
    -- User notes and flags
    notes TEXT,
    read TEXT, -- ISO date when marked as read
    favorite BOOLEAN DEFAULT false,
    
    -- UI metadata
    icon TEXT,
    color TEXT,
    
    -- Preset reference
    preset_id UUID,
    
    -- Flexible metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_works_title ON works(title);
CREATE INDEX idx_works_work_type ON works(work_type);
CREATE INDEX idx_works_favorite ON works(favorite) WHERE favorite = true;
CREATE INDEX idx_works_year ON works(year) WHERE year IS NOT NULL;
CREATE INDEX idx_works_preset_id ON works(preset_id) WHERE preset_id IS NOT NULL;
CREATE INDEX idx_works_author_ids ON works USING GIN(author_ids);
CREATE INDEX idx_works_created_at ON works(created_at);
CREATE INDEX idx_works_updated_at ON works(updated_at);

-- ============================================================================
-- Assets table (files bound to CAS blobs)
-- ============================================================================
CREATE TABLE assets (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'asset' CHECK (kind = 'asset'),
    
    -- Foreign keys
    work_id UUID REFERENCES works(id) ON DELETE SET NULL,
    annotation_id UUID, -- Forward reference to annotations
    
    -- CAS reference
    sha256 TEXT NOT NULL,
    
    -- Asset metadata
    filename TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'main',
    purpose TEXT,
    mime TEXT NOT NULL,
    bytes BIGINT NOT NULL,
    page_count INTEGER,
    
    -- Publication metadata (for assets that carry edition info)
    year INTEGER,
    read TEXT,
    favorite BOOLEAN DEFAULT false,
    
    -- Preset reference
    preset_id UUID,
    
    -- Flexible metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_assets_work_id ON assets(work_id) WHERE work_id IS NOT NULL;
CREATE INDEX idx_assets_annotation_id ON assets(annotation_id) WHERE annotation_id IS NOT NULL;
CREATE INDEX idx_assets_sha256 ON assets(sha256);
CREATE INDEX idx_assets_role ON assets(role);
CREATE INDEX idx_assets_purpose ON assets(purpose) WHERE purpose IS NOT NULL;
CREATE INDEX idx_assets_mime ON assets(mime);
CREATE INDEX idx_assets_preset_id ON assets(preset_id) WHERE preset_id IS NOT NULL;
CREATE INDEX idx_assets_created_at ON assets(created_at);
CREATE INDEX idx_assets_updated_at ON assets(updated_at);

-- ============================================================================
-- Activities table (courses, projects, study sessions)
-- ============================================================================
CREATE TABLE activities (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'activity' CHECK (kind = 'activity'),
    
    -- Core identity
    title TEXT NOT NULL,
    activity_type TEXT NOT NULL DEFAULT 'study',
    
    -- Scheduling
    starts_at TEXT,
    ends_at TEXT,
    
    -- Participants (array of person objects as JSON)
    participants JSONB DEFAULT '[]',
    
    -- UI metadata
    icon TEXT,
    color TEXT,
    
    -- User notes
    notes TEXT,
    
    -- Flexible metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_activities_title ON activities(title);
CREATE INDEX idx_activities_activity_type ON activities(activity_type);
CREATE INDEX idx_activities_starts_at ON activities(starts_at) WHERE starts_at IS NOT NULL;
CREATE INDEX idx_activities_ends_at ON activities(ends_at) WHERE ends_at IS NOT NULL;
CREATE INDEX idx_activities_created_at ON activities(created_at);
CREATE INDEX idx_activities_updated_at ON activities(updated_at);

-- ============================================================================
-- Collections table (curation/grouping)
-- ============================================================================
CREATE TABLE collections (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'collection' CHECK (kind = 'collection'),
    
    -- Core identity
    name TEXT NOT NULL,
    description TEXT,
    
    -- Privacy flag
    is_private BOOLEAN DEFAULT false,
    
    -- Order for contained items
    item_order UUID[] DEFAULT '{}',
    
    -- UI metadata
    icon TEXT,
    color TEXT,
    
    -- Flexible metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_collections_name ON collections(name);
CREATE INDEX idx_collections_is_private ON collections(is_private);
CREATE INDEX idx_collections_created_at ON collections(created_at);
CREATE INDEX idx_collections_updated_at ON collections(updated_at);

-- ============================================================================
-- Edges table (typed relationships between entities)
-- ============================================================================
CREATE TABLE edges (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'edge' CHECK (kind = 'edge'),
    
    -- Relationship
    from_id UUID NOT NULL,
    to_id UUID NOT NULL,
    relation TEXT NOT NULL, -- 'contains', 'references', 'cites', etc.
    
    -- Optional label for the edge
    label TEXT,
    
    -- Flexible metadata
    metadata JSONB,
    
    -- Timestamp
    created_at TEXT NOT NULL
);

CREATE INDEX idx_edges_from_id ON edges(from_id);
CREATE INDEX idx_edges_to_id ON edges(to_id);
CREATE INDEX idx_edges_relation ON edges(relation);
CREATE INDEX idx_edges_from_to_relation ON edges(from_id, to_id, relation);
CREATE INDEX idx_edges_created_at ON edges(created_at);

-- ============================================================================
-- Presets table (templates for creating entities)
-- ============================================================================
CREATE TABLE presets (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'preset' CHECK (kind = 'preset'),
    
    -- Core identity
    name TEXT NOT NULL,
    description TEXT,
    
    -- Target entity type
    target_entity TEXT NOT NULL, -- 'work', 'asset', 'activity', etc.
    
    -- System vs user-created
    is_system BOOLEAN DEFAULT false,
    
    -- Form configuration (JSON schema for fields)
    form_fields JSONB NOT NULL,
    
    -- Default values
    default_values JSONB,
    
    -- UI metadata
    icon TEXT,
    color TEXT,
    
    -- Timestamps
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_presets_name ON presets(name);
CREATE INDEX idx_presets_target_entity ON presets(target_entity);
CREATE INDEX idx_presets_is_system ON presets(is_system);
CREATE INDEX idx_presets_created_at ON presets(created_at);
CREATE INDEX idx_presets_updated_at ON presets(updated_at);

-- ============================================================================
-- Annotations table (PDF annotations, highlights, notes)
-- ============================================================================
CREATE TABLE annotations (
    id UUID PRIMARY KEY,
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

-- ============================================================================
-- Cards table (SRS flashcards)
-- ============================================================================
CREATE TABLE cards (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'card' CHECK (kind = 'card'),
    
    -- Reference to annotation
    annotation_id UUID NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
    
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

-- ============================================================================
-- Review Logs table (SRS review history)
-- ============================================================================
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

-- ============================================================================
-- Comments on schema design
-- ============================================================================
-- 1. All UUIDs are client-generated (uuid-ossp for server-side generation if needed)
-- 2. Timestamps are TEXT (ISO 8601) to match Dexie format exactly
-- 3. JSONB for flexible metadata and complex objects
-- 4. Arrays for multi-valued fields (author_ids, topics, titles, etc.)
-- 5. Indices optimized for common queries (title search, author lookup, date ranges)
-- 6. Foreign keys with SET NULL or CASCADE as appropriate
-- 7. CHECK constraints for kind fields (ensures polymorphic identity)
