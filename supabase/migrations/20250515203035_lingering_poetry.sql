/*
  # Add media support to messages

  1. Changes
    - Add media column to messages table to store file URLs
    - Add media_type column to distinguish between images and videos
*/

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS media text[],
ADD COLUMN IF NOT EXISTS media_type text[];

COMMENT ON COLUMN messages.media IS 'Array of media URLs';
COMMENT ON COLUMN messages.media_type IS 'Array of media types (image/video) corresponding to media URLs';