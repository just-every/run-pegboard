-- Native text revisions remain scoped to their parent and follow reviewed erasure.
ALTER TABLE peg_comments ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE peg_comments ADD COLUMN deleted_at INTEGER;
CREATE TABLE peg_comment_versions (
 comment_id TEXT NOT NULL REFERENCES peg_comments(id) ON DELETE CASCADE,
 version INTEGER NOT NULL, body TEXT NOT NULL, actor_id TEXT NOT NULL,
 created_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(comment_id,version)
);
INSERT INTO peg_comment_versions SELECT id,1,body,author_id,created_at,0 FROM peg_comments;
CREATE TRIGGER peg_comment_initial_revision AFTER INSERT ON peg_comments BEGIN
 INSERT INTO peg_comment_versions VALUES(NEW.id,1,NEW.body,NEW.author_id,NEW.created_at,0);
END;
CREATE TABLE peg_description_versions (
 task_id TEXT NOT NULL REFERENCES peg_tasks(id) ON DELETE CASCADE,
 version INTEGER NOT NULL, text TEXT NOT NULL, actor_id TEXT,
 created_at INTEGER NOT NULL, PRIMARY KEY(task_id,version)
);
-- Existing text has no reliable last editor; do not invent one.
INSERT INTO peg_description_versions SELECT id,1,description,NULL,updated_at FROM peg_tasks;
CREATE TRIGGER peg_description_initial_revision AFTER INSERT ON peg_tasks BEGIN
 INSERT INTO peg_description_versions VALUES(NEW.id,1,NEW.description,NEW.creator_id,NEW.created_at);
END;
CREATE TABLE peg_comment_reactions (
 comment_id TEXT NOT NULL REFERENCES peg_comments(id) ON DELETE CASCADE,
 actor_id TEXT NOT NULL, reaction TEXT NOT NULL, active INTEGER NOT NULL,
 at INTEGER NOT NULL, PRIMARY KEY(comment_id,actor_id,reaction)
);
CREATE TABLE peg_collaboration_intents (
 actor_id TEXT NOT NULL, operation_key TEXT NOT NULL, task_id TEXT NOT NULL,
 comment_id TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT NOT NULL,
 PRIMARY KEY(actor_id,operation_key)
);
CREATE TRIGGER peg_comment_collaboration_erasure AFTER DELETE ON peg_comments BEGIN
 DELETE FROM peg_comment_versions WHERE comment_id=OLD.id;
 DELETE FROM peg_comment_reactions WHERE comment_id=OLD.id;
 DELETE FROM peg_collaboration_intents WHERE comment_id=OLD.id;
END;
CREATE TRIGGER peg_description_collaboration_erasure AFTER DELETE ON peg_tasks BEGIN
 DELETE FROM peg_description_versions WHERE task_id=OLD.id;
 DELETE FROM peg_collaboration_intents WHERE task_id=OLD.id;
END;
CREATE TRIGGER peg_comment_versions_immutable BEFORE UPDATE ON peg_comment_versions BEGIN
 SELECT RAISE(ABORT,'immutable_comment_version');
END;
CREATE TRIGGER peg_description_versions_immutable BEFORE UPDATE ON peg_description_versions BEGIN
 SELECT RAISE(ABORT,'immutable_description_version');
END;
CREATE TRIGGER peg_comment_versions_revision_insert AFTER INSERT ON peg_comment_versions BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_comment_versions_revision_update AFTER UPDATE ON peg_comment_versions BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_comment_versions_revision_delete AFTER DELETE ON peg_comment_versions BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_description_versions_revision_insert AFTER INSERT ON peg_description_versions BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_description_versions_revision_update AFTER UPDATE ON peg_description_versions BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_description_versions_revision_delete AFTER DELETE ON peg_description_versions BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_comment_reactions_revision_insert AFTER INSERT ON peg_comment_reactions BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_comment_reactions_revision_update AFTER UPDATE ON peg_comment_reactions BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_comment_reactions_revision_delete AFTER DELETE ON peg_comment_reactions BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_collaboration_intents_revision_insert AFTER INSERT ON peg_collaboration_intents BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_collaboration_intents_revision_update AFTER UPDATE ON peg_collaboration_intents BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_collaboration_intents_revision_delete AFTER DELETE ON peg_collaboration_intents BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
