-- Optional supplied reference media; does not change fleet availability.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS video_path varchar(250);
