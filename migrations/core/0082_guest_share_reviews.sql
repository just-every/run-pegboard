-- Reviews record opaque content identities and a digest, never retained task text.
CREATE TABLE peg_guest_share_reviews (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL, recipient_id TEXT NOT NULL,
 actor_id TEXT NOT NULL, proposal TEXT NOT NULL, manifest TEXT NOT NULL,
 fingerprint TEXT NOT NULL, revision INTEGER NOT NULL, authority_until INTEGER,
 review_until INTEGER NOT NULL, created_at INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','approved','cancelled')),
 decided_at INTEGER, grant_id TEXT
);
CREATE INDEX peg_guest_share_project ON peg_guest_share_reviews(project_id,created_at);
CREATE TABLE peg_guest_share_decisions (
 review_id TEXT PRIMARY KEY REFERENCES peg_guest_share_reviews(id),
 decision TEXT NOT NULL CHECK(decision IN ('approve','cancel')), actor_id TEXT NOT NULL, at INTEGER NOT NULL
);
CREATE TRIGGER peg_guest_share_decision_once BEFORE INSERT ON peg_guest_share_decisions
WHEN NOT EXISTS(SELECT 1 FROM peg_guest_share_reviews WHERE id=NEW.review_id AND status='pending' AND actor_id=NEW.actor_id)
BEGIN SELECT RAISE(ABORT,'stale_personal_preview'); END;
CREATE TRIGGER peg_guest_share_review_immutable BEFORE UPDATE OF project_id,recipient_id,actor_id,proposal,manifest,fingerprint,revision,authority_until,created_at ON peg_guest_share_reviews
BEGIN SELECT RAISE(ABORT,'guest_review_immutable'); END;
CREATE TRIGGER peg_guest_share_decision_immutable BEFORE UPDATE ON peg_guest_share_decisions
BEGIN SELECT RAISE(ABORT,'guest_decision_immutable'); END;
CREATE TRIGGER peg_guest_share_review_no_extension BEFORE UPDATE OF review_until ON peg_guest_share_reviews
WHEN NEW.review_until>OLD.review_until
BEGIN SELECT RAISE(ABORT,'guest_review_immutable'); END;
-- Restoring an earlier policy never revives a review made under older authority.
CREATE TRIGGER peg_guest_review_authority_revision AFTER UPDATE ON peg_epoch
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
