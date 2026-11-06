-- Human-reviewed text announcements. A publication never changes project authority.
CREATE TABLE peg_message_drafts (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL, author_id TEXT NOT NULL,
 version INTEGER NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, links TEXT NOT NULL, recipients TEXT NOT NULL,
 corrects_id TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, inactive INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE peg_message_publications (
 id TEXT PRIMARY KEY, root_id TEXT NOT NULL, draft_id TEXT NOT NULL UNIQUE, draft_version INTEGER NOT NULL,
 project_id TEXT NOT NULL, author_id TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, links TEXT NOT NULL,
 recipients TEXT NOT NULL, corrects_id TEXT UNIQUE, published_at INTEGER NOT NULL, inactive INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE peg_message_comments (
 id TEXT PRIMARY KEY, root_id TEXT NOT NULL, publication_id TEXT NOT NULL, parent_id TEXT,
 author_id TEXT NOT NULL, body TEXT NOT NULL, revision INTEGER NOT NULL, deleted_at INTEGER,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, operation_key TEXT NOT NULL, UNIQUE(author_id,operation_key)
);
CREATE TABLE peg_message_comment_history (
 id TEXT PRIMARY KEY, comment_id TEXT NOT NULL, author_id TEXT NOT NULL, revision INTEGER NOT NULL,
 body TEXT NOT NULL, deleted_at INTEGER, at INTEGER NOT NULL, UNIQUE(comment_id,revision)
);
CREATE TABLE peg_message_preferences (
 root_id TEXT NOT NULL, operator_id TEXT NOT NULL, following INTEGER NOT NULL, muted INTEGER NOT NULL,
 PRIMARY KEY(root_id,operator_id)
);
CREATE TABLE peg_message_notices (
 id TEXT PRIMARY KEY, root_id TEXT NOT NULL, publication_id TEXT NOT NULL, event_id TEXT NOT NULL,
 recipient_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('publication','reply')), created_at INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('active','cancelled')), UNIQUE(event_id,recipient_id)
);
CREATE INDEX peg_message_project ON peg_message_publications(project_id,published_at);
CREATE INDEX peg_message_recipient ON peg_message_notices(recipient_id,state);
CREATE TRIGGER peg_message_publication_immutable BEFORE UPDATE ON peg_message_publications BEGIN SELECT RAISE(ABORT,'immutable_message_publication'); END;
CREATE TRIGGER peg_message_history_immutable BEFORE UPDATE ON peg_message_comment_history BEGIN SELECT RAISE(ABORT,'immutable_message_history'); END;
CREATE TRIGGER peg_message_comment_identity BEFORE UPDATE ON peg_message_comments
WHEN NEW.id<>OLD.id OR NEW.root_id<>OLD.root_id OR NEW.publication_id<>OLD.publication_id OR NEW.parent_id IS NOT OLD.parent_id OR NEW.author_id<>OLD.author_id OR NEW.created_at<>OLD.created_at OR NEW.operation_key<>OLD.operation_key OR NEW.revision<>OLD.revision+1
BEGIN SELECT RAISE(ABORT,'immutable_message_comment_identity'); END;
CREATE TRIGGER peg_message_inactive_person AFTER UPDATE ON oa_operators WHEN NEW.status<>'active' BEGIN UPDATE peg_message_notices SET state='cancelled' WHERE recipient_id=NEW.id; END;
CREATE TRIGGER peg_message_changed_member AFTER UPDATE ON peg_workspace_members BEGIN UPDATE peg_message_notices SET state='cancelled' WHERE recipient_id=NEW.operator_id; END;
CREATE TRIGGER peg_message_removed_member AFTER DELETE ON peg_workspace_members BEGIN UPDATE peg_message_notices SET state='cancelled' WHERE recipient_id=OLD.operator_id; END;
CREATE TRIGGER peg_message_changed_grant AFTER UPDATE ON peg_grants BEGIN UPDATE peg_message_notices SET state='cancelled' WHERE root_id IN (SELECT root_id FROM peg_message_publications WHERE project_id=NEW.object_id) OR recipient_id=NEW.grantee_id; END;
CREATE TRIGGER peg_message_removed_grant AFTER DELETE ON peg_grants BEGIN UPDATE peg_message_notices SET state='cancelled' WHERE root_id IN (SELECT root_id FROM peg_message_publications WHERE project_id=OLD.object_id) OR recipient_id=OLD.grantee_id; END;
CREATE TRIGGER peg_message_changed_project AFTER UPDATE ON peg_projects BEGIN UPDATE peg_message_notices SET state='cancelled' WHERE root_id IN (SELECT root_id FROM peg_message_publications WHERE project_id=NEW.id); END;
CREATE TRIGGER peg_message_drafts_insert AFTER INSERT ON peg_message_drafts BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_drafts_update AFTER UPDATE ON peg_message_drafts BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_drafts_delete AFTER DELETE ON peg_message_drafts BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_publications_insert AFTER INSERT ON peg_message_publications BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_publications_update AFTER UPDATE ON peg_message_publications BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_publications_delete AFTER DELETE ON peg_message_publications BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_comments_insert AFTER INSERT ON peg_message_comments BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_comments_update AFTER UPDATE ON peg_message_comments BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_comments_delete AFTER DELETE ON peg_message_comments BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_comment_history_insert AFTER INSERT ON peg_message_comment_history BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_comment_history_update AFTER UPDATE ON peg_message_comment_history BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_comment_history_delete AFTER DELETE ON peg_message_comment_history BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_preferences_insert AFTER INSERT ON peg_message_preferences BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_preferences_update AFTER UPDATE ON peg_message_preferences BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_preferences_delete AFTER DELETE ON peg_message_preferences BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_notices_insert AFTER INSERT ON peg_message_notices BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_notices_update AFTER UPDATE ON peg_message_notices BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_message_notices_delete AFTER DELETE ON peg_message_notices BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
