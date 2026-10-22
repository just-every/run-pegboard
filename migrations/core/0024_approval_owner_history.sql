-- Who has owned an approval task since its previous decision (the epoch is the count of decisions so far).
-- Reassigning the task never launders sign-off: every owner of the current epoch, and the owner at the last decision, is refused as its decider.
CREATE TABLE peg_approval_owners (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, owner_id TEXT NOT NULL, epoch INTEGER NOT NULL);
CREATE INDEX peg_approval_owners_task ON peg_approval_owners(task_id,epoch);
INSERT INTO peg_approval_owners(task_id,owner_id,epoch)
  SELECT t.id,t.owner_id,(SELECT COUNT(*) FROM peg_task_decisions d WHERE d.task_id=t.id) FROM peg_tasks t JOIN peg_approval_tasks a ON a.task_id=t.id;
CREATE TRIGGER peg_approval_owner_created AFTER INSERT ON peg_approval_tasks BEGIN
  INSERT INTO peg_approval_owners(task_id,owner_id,epoch) SELECT id,owner_id,0 FROM peg_tasks WHERE id=NEW.task_id;
END;
CREATE TRIGGER peg_approval_owner_changed AFTER UPDATE OF owner_id ON peg_tasks
WHEN NEW.owner_id<>OLD.owner_id AND EXISTS(SELECT 1 FROM peg_approval_tasks WHERE task_id=NEW.id) BEGIN
  INSERT INTO peg_approval_owners(task_id,owner_id,epoch) VALUES(NEW.id,NEW.owner_id,(SELECT COUNT(*) FROM peg_task_decisions WHERE task_id=NEW.id));
END;
CREATE TRIGGER peg_approval_owner_at_decision AFTER INSERT ON peg_task_decisions BEGIN
  INSERT INTO peg_approval_owners(task_id,owner_id,epoch) SELECT NEW.task_id,owner_id,(SELECT COUNT(*) FROM peg_task_decisions WHERE task_id=NEW.task_id) FROM peg_tasks WHERE id=NEW.task_id;
END;
