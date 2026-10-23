-- Time deliveries are retained outside current erasure scope. Their existing sender witnesses a claim through D1's
-- affected-row count (which includes trigger writes), so custody must not add a write trigger to this ledger.
-- Append-only delivery-history expiry still selects exact immutable keys under its frozen reviewed cutoff.
DROP TRIGGER peg_data_revision_peg_time_deliveries_insert;
DROP TRIGGER peg_data_revision_peg_time_deliveries_update;
DROP TRIGGER peg_data_revision_peg_time_deliveries_delete;
