-- Boards and Strokes Migration
-- Add support for note-taking canvas with drawing

-- ============================================================================
-- Boards table
-- ============================================================================
CREATE TABLE boards (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'board' CHECK (kind = 'board'),
    
    -- Core identity
    title TEXT NOT NULL,
    description TEXT,
    
    -- UI metadata
    icon TEXT,
    color TEXT,
    
    -- Canvas properties
    width INTEGER NOT NULL DEFAULT 10000,
    height INTEGER NOT NULL DEFAULT 10000,
    background_color TEXT NOT NULL DEFAULT '#ffffff',
    
    -- Timestamps (ISO 8601 strings)
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_boards_title ON boards(title);
CREATE INDEX idx_boards_created_at ON boards(created_at);

-- ============================================================================
-- Strokes table
-- ============================================================================
CREATE TABLE strokes (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'stroke' CHECK (kind = 'stroke'),
    
    -- Board reference
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    
    -- Points data (JSON array of {x, y, pressure, timestamp, tiltX?, tiltY?})
    points JSONB NOT NULL,
    
    -- Style (JSON object {color, width, opacity, brushType})
    style JSONB NOT NULL,
    
    -- Bounding box for spatial queries (JSON {x, y, width, height})
    bounding_box JSONB NOT NULL,
    
    -- Timestamps (ISO 8601 strings)
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_strokes_board_id ON strokes(board_id);
CREATE INDEX idx_strokes_created_at ON strokes(created_at);

-- Enable Electric replication for boards and strokes
ALTER TABLE boards ENABLE ELECTRIC;
ALTER TABLE strokes ENABLE ELECTRIC;

COMMENT ON TABLE boards IS 'Canvas boards for note-taking with drawing support';
COMMENT ON TABLE strokes IS 'Individual pen/brush strokes on canvas boards';
