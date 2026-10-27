ALTER TABLE peg_comments ADD COLUMN internal_only INTEGER NOT NULL DEFAULT 0 CHECK (internal_only IN (0,1));
