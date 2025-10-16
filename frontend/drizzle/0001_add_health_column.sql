-- Add health column to blobs table
ALTER TABLE `blobs` ADD COLUMN `health` text DEFAULT 'healthy';
