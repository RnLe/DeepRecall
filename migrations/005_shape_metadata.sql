-- Migration: Add shape_metadata column to strokes table
-- This supports inking aids feature (geometric shape detection)

ALTER TABLE strokes 
ADD COLUMN shape_metadata JSONB;

-- Add index for querying by shape type
CREATE INDEX idx_strokes_shape_type ON strokes ((shape_metadata->>'shapeType')) WHERE shape_metadata IS NOT NULL;

-- Add comment
COMMENT ON COLUMN strokes.shape_metadata IS 'Optional metadata for geometric shapes (line, circle, ellipse, rectangle, square) with fill settings';
