-- A readback never races an invocation still dispatching the reviewed events.
ALTER TABLE peg_focus_reviews ADD COLUMN lease_until INTEGER NOT NULL DEFAULT 0;

ALTER TABLE peg_calendar_previews ADD COLUMN context_revision INTEGER;
ALTER TABLE peg_calendar_previews ADD COLUMN busy_stamp TEXT;
