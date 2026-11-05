-- Only an immediately acknowledged ordinary send has a redundant sending diagnostic.
-- Corrections, rejected attempts and uncertain reconciliation keep their complete history.
CREATE VIEW peg_time_expirable_diagnostics AS
SELECT h.id,h.service,h.account,h.entry_id,h.sheet_id,h.actor_id,h.at,s.workspace_id,a.id acknowledgment_id
FROM peg_time_delivery_history h
JOIN peg_timesheets s ON s.id=h.sheet_id
JOIN peg_time_deliveries d ON d.service=h.service AND d.account=h.account AND d.entry_id=h.entry_id AND d.sheet_id=h.sheet_id
JOIN peg_time_delivery_history a ON a.id=(
 SELECT MIN(n.id) FROM peg_time_delivery_history n
 WHERE n.service=h.service AND n.account=h.account AND n.entry_id=h.entry_id AND n.id>h.id
)
WHERE h.state='sending' AND d.kind='entry' AND d.state='acknowledged' AND d.reason IS NULL
AND a.state='acknowledged' AND a.sheet_id=h.sheet_id AND a.actor_id=h.actor_id AND a.actor_id=d.actor_id
AND a.at>=h.at AND a.provider_id=d.provider_id AND a.provider_seconds=d.provider_seconds AND a.reason IS NULL
AND NOT EXISTS(SELECT 1 FROM peg_time_deliveries c WHERE c.service=d.service AND c.account=d.account
 AND c.target_entry_id=d.entry_id AND c.kind='correction' AND (c.state<>'acknowledged' OR c.reason IS NOT NULL));

-- A permit exists only inside the revision-checked expiry transaction, for exact reviewed rows.
CREATE TABLE peg_time_diagnostic_expiry (
 history_id INTEGER PRIMARY KEY,workspace_id TEXT NOT NULL,actor_id TEXT NOT NULL,
 revision INTEGER NOT NULL,cutoff INTEGER NOT NULL,not_after INTEGER NOT NULL
);
CREATE TRIGGER peg_time_diagnostic_expiry_guard BEFORE INSERT ON peg_time_diagnostic_expiry BEGIN
 SELECT CASE WHEN NEW.revision<>(SELECT value FROM peg_data_revision WHERE id=1)
 OR NEW.not_after<=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
 OR NOT EXISTS(SELECT 1 FROM oa_operators WHERE id=NEW.actor_id AND role='owner' AND status='active')
 OR NOT EXISTS(SELECT 1 FROM peg_retention_classes p WHERE p.workspace_id=NEW.workspace_id AND p.class='provider_logs'
  AND p.days IS NOT NULL AND NEW.cutoff<=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)-p.days*86400000)
 OR EXISTS(SELECT 1 FROM peg_data_holds WHERE workspace_id=NEW.workspace_id AND released_at IS NULL
  AND expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))
 OR NOT EXISTS(SELECT 1 FROM peg_time_expirable_diagnostics e WHERE e.id=NEW.history_id AND e.workspace_id=NEW.workspace_id AND e.at<=NEW.cutoff)
 THEN RAISE(ABORT,'stale_data_preview') END;
END;
DROP TRIGGER peg_time_delivery_history_undeleted;
CREATE TRIGGER peg_time_delivery_history_undeleted BEFORE DELETE ON peg_time_delivery_history
WHEN NOT EXISTS(SELECT 1 FROM peg_time_diagnostic_expiry p JOIN peg_time_expirable_diagnostics e ON e.id=p.history_id
 WHERE p.history_id=OLD.id AND e.workspace_id=p.workspace_id AND e.at<=p.cutoff
 AND p.not_after>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
 AND EXISTS(SELECT 1 FROM oa_operators WHERE id=p.actor_id AND role='owner' AND status='active')
 AND NOT EXISTS(SELECT 1 FROM peg_data_holds h WHERE h.workspace_id=p.workspace_id AND h.released_at IS NULL
  AND h.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)))
BEGIN SELECT RAISE(ABORT,'time_delivery_history_is_preserved'); END;
CREATE TRIGGER peg_time_diagnostic_expiry_consume AFTER DELETE ON peg_time_delivery_history
BEGIN DELETE FROM peg_time_diagnostic_expiry WHERE history_id=OLD.id; END;
