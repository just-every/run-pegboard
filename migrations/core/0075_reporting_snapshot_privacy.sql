-- Discard expiring caches captured before membership-only events were projected safely.
-- Source events and saved dashboards remain intact; the next capture uses current authority.
DELETE FROM peg_report_snapshots;
