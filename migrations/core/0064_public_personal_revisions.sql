-- Fence section and layout edits against every native and external write.
CREATE TRIGGER peg_public_rev_peg_personal_sections_insert AFTER INSERT ON peg_personal_sections BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_public_rev_peg_personal_sections_update AFTER UPDATE ON peg_personal_sections BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_public_rev_peg_personal_sections_delete AFTER DELETE ON peg_personal_sections BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_public_rev_peg_personal_layout_insert AFTER INSERT ON peg_personal_layout BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_public_rev_peg_personal_layout_update AFTER UPDATE ON peg_personal_layout BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_public_rev_peg_personal_layout_delete AFTER DELETE ON peg_personal_layout BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
