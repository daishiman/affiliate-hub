CREATE TABLE `article_image_sweep_state` (
	`id` text PRIMARY KEY NOT NULL,
	`cursor` text,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
-- 既存画像をコピー/削除せず列を足す。生成器のrebuildは未存在の新列をSELECTするため使わない。
ALTER TABLE `article_image` ADD `lifecycle` text DEFAULT 'ready' NOT NULL
  CONSTRAINT `article_image_lifecycle_check` CHECK (`lifecycle` IN ('pending', 'ready', 'deleting', 'deleted'));--> statement-breakpoint
ALTER TABLE `article_image` ADD `deleted_at` integer;--> statement-breakpoint
CREATE VIEW `article_image_reference_text` AS 
  SELECT workspace_id, body FROM blog_article_block
  UNION ALL
  SELECT b.workspace_id, CAST(j.value AS TEXT) FROM blog_article_block b,
    json_tree(CASE
      WHEN json_valid(b.body) THEN b.body
      WHEN substr(b.body, 1, 20) = 'expression-block:v1:' AND json_valid(substr(b.body, 21)) THEN substr(b.body, 21)
      ELSE 'null' END) j WHERE j.type = 'text'
  UNION ALL
  SELECT workspace_id, article_json AS body FROM published_articles
  UNION ALL
  SELECT p.workspace_id, CAST(j.value AS TEXT) FROM published_articles p,
    json_tree(CASE WHEN json_valid(p.article_json) THEN p.article_json ELSE 'null' END) j WHERE j.type = 'text'
;

--> statement-breakpoint
CREATE TRIGGER article_image_identity_immutable BEFORE UPDATE OF id, object_key, workspace_id, article_id ON article_image
WHEN NEW.id <> OLD.id OR NEW.object_key <> OLD.object_key OR NEW.workspace_id <> OLD.workspace_id OR NEW.article_id <> OLD.article_id
BEGIN SELECT RAISE(ABORT, 'article_image_identity_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER article_image_lifecycle_monotonic BEFORE UPDATE OF lifecycle ON article_image
WHEN NOT (NEW.lifecycle = OLD.lifecycle OR (OLD.lifecycle = 'pending' AND NEW.lifecycle IN ('ready', 'deleting'))
  OR (OLD.lifecycle = 'ready' AND NEW.lifecycle = 'deleting') OR (OLD.lifecycle = 'deleting' AND NEW.lifecycle = 'deleted'))
BEGIN SELECT RAISE(ABORT, 'article_image_lifecycle_invalid'); END;
--> statement-breakpoint
CREATE TRIGGER article_image_keep_tombstone BEFORE DELETE ON article_image
WHEN OLD.lifecycle IN ('deleting', 'deleted')
BEGIN SELECT RAISE(ABORT, 'article_image_tombstone_required'); END;
--> statement-breakpoint
CREATE TRIGGER article_image_claim_guard BEFORE UPDATE OF lifecycle ON article_image
WHEN NEW.lifecycle = 'deleting' AND OLD.lifecycle <> 'deleting'
  AND EXISTS (SELECT 1 FROM article_image_reference_text r WHERE r.workspace_id = OLD.workspace_id AND instr(r.body, OLD.id) > 0)
BEGIN SELECT RAISE(ABORT, 'article_image_still_referenced'); END;
--> statement-breakpoint
CREATE TRIGGER blog_article_block_image_guard_insert BEFORE INSERT ON blog_article_block
WHEN EXISTS (SELECT 1 FROM article_image WHERE workspace_id = NEW.workspace_id AND lifecycle <> 'ready' AND EXISTS (SELECT 1 FROM (SELECT NEW.body AS body UNION ALL SELECT CAST(value AS TEXT) FROM json_tree(CASE WHEN json_valid(NEW.body) THEN NEW.body WHEN substr(NEW.body, 1, 20) = 'expression-block:v1:' AND json_valid(substr(NEW.body, 21)) THEN substr(NEW.body, 21) ELSE 'null' END) WHERE type = 'text') text_ref WHERE instr(text_ref.body, article_image.id) > 0))
BEGIN SELECT RAISE(ABORT, 'article_image_unavailable'); END;
--> statement-breakpoint
CREATE TRIGGER blog_article_block_image_reference_insert AFTER INSERT ON blog_article_block
BEGIN UPDATE article_image SET last_referenced_at = max(coalesce(last_referenced_at, 0), unixepoch()), referenced = 1
WHERE workspace_id = NEW.workspace_id AND lifecycle = 'ready' AND EXISTS (SELECT 1 FROM (SELECT NEW.body AS body UNION ALL SELECT CAST(value AS TEXT) FROM json_tree(CASE WHEN json_valid(NEW.body) THEN NEW.body WHEN substr(NEW.body, 1, 20) = 'expression-block:v1:' AND json_valid(substr(NEW.body, 21)) THEN substr(NEW.body, 21) ELSE 'null' END) WHERE type = 'text') text_ref WHERE instr(text_ref.body, article_image.id) > 0); END;
--> statement-breakpoint
CREATE TRIGGER blog_article_block_image_guard_update BEFORE UPDATE OF workspace_id, body ON blog_article_block
WHEN EXISTS (SELECT 1 FROM article_image WHERE workspace_id = NEW.workspace_id AND lifecycle <> 'ready' AND EXISTS (SELECT 1 FROM (SELECT NEW.body AS body UNION ALL SELECT CAST(value AS TEXT) FROM json_tree(CASE WHEN json_valid(NEW.body) THEN NEW.body WHEN substr(NEW.body, 1, 20) = 'expression-block:v1:' AND json_valid(substr(NEW.body, 21)) THEN substr(NEW.body, 21) ELSE 'null' END) WHERE type = 'text') text_ref WHERE instr(text_ref.body, article_image.id) > 0))
BEGIN SELECT RAISE(ABORT, 'article_image_unavailable'); END;
--> statement-breakpoint
CREATE TRIGGER blog_article_block_image_reference_update AFTER UPDATE OF workspace_id, body ON blog_article_block
BEGIN UPDATE article_image SET last_referenced_at = max(coalesce(last_referenced_at, 0), unixepoch()), referenced = 1
WHERE workspace_id = NEW.workspace_id AND lifecycle = 'ready' AND EXISTS (SELECT 1 FROM (SELECT NEW.body AS body UNION ALL SELECT CAST(value AS TEXT) FROM json_tree(CASE WHEN json_valid(NEW.body) THEN NEW.body WHEN substr(NEW.body, 1, 20) = 'expression-block:v1:' AND json_valid(substr(NEW.body, 21)) THEN substr(NEW.body, 21) ELSE 'null' END) WHERE type = 'text') text_ref WHERE instr(text_ref.body, article_image.id) > 0); END;
--> statement-breakpoint
CREATE TRIGGER blog_article_block_image_detach_update BEFORE UPDATE OF workspace_id, body ON blog_article_block
BEGIN UPDATE article_image SET last_referenced_at = max(coalesce(last_referenced_at, 0), unixepoch())
WHERE workspace_id = OLD.workspace_id AND lifecycle = 'ready' AND EXISTS (SELECT 1 FROM (SELECT OLD.body AS body UNION ALL SELECT CAST(value AS TEXT) FROM json_tree(CASE WHEN json_valid(OLD.body) THEN OLD.body WHEN substr(OLD.body, 1, 20) = 'expression-block:v1:' AND json_valid(substr(OLD.body, 21)) THEN substr(OLD.body, 21) ELSE 'null' END) WHERE type = 'text') text_ref WHERE instr(text_ref.body, article_image.id) > 0); END;
--> statement-breakpoint
CREATE TRIGGER blog_article_block_image_detach_delete BEFORE DELETE ON blog_article_block
BEGIN UPDATE article_image SET last_referenced_at = max(coalesce(last_referenced_at, 0), unixepoch())
WHERE workspace_id = OLD.workspace_id AND lifecycle = 'ready' AND EXISTS (SELECT 1 FROM (SELECT OLD.body AS body UNION ALL SELECT CAST(value AS TEXT) FROM json_tree(CASE WHEN json_valid(OLD.body) THEN OLD.body WHEN substr(OLD.body, 1, 20) = 'expression-block:v1:' AND json_valid(substr(OLD.body, 21)) THEN substr(OLD.body, 21) ELSE 'null' END) WHERE type = 'text') text_ref WHERE instr(text_ref.body, article_image.id) > 0); END;
--> statement-breakpoint
CREATE TRIGGER published_articles_image_guard_insert BEFORE INSERT ON published_articles
WHEN EXISTS (SELECT 1 FROM article_image WHERE workspace_id = NEW.workspace_id AND lifecycle <> 'ready' AND EXISTS (SELECT 1 FROM (SELECT NEW.article_json AS body UNION ALL SELECT CAST(value AS TEXT) FROM json_tree(CASE WHEN json_valid(NEW.article_json) THEN NEW.article_json ELSE 'null' END) WHERE type = 'text') text_ref WHERE instr(text_ref.body, article_image.id) > 0))
BEGIN SELECT RAISE(ABORT, 'article_image_unavailable'); END;
--> statement-breakpoint
CREATE TRIGGER published_articles_image_reference_insert AFTER INSERT ON published_articles
BEGIN UPDATE article_image SET last_referenced_at = max(coalesce(last_referenced_at, 0), unixepoch()), referenced = 1
WHERE workspace_id = NEW.workspace_id AND lifecycle = 'ready' AND EXISTS (SELECT 1 FROM (SELECT NEW.article_json AS body UNION ALL SELECT CAST(value AS TEXT) FROM json_tree(CASE WHEN json_valid(NEW.article_json) THEN NEW.article_json ELSE 'null' END) WHERE type = 'text') text_ref WHERE instr(text_ref.body, article_image.id) > 0); END;
--> statement-breakpoint
CREATE TRIGGER published_articles_image_guard_update BEFORE UPDATE OF workspace_id, article_json ON published_articles
WHEN EXISTS (SELECT 1 FROM article_image WHERE workspace_id = NEW.workspace_id AND lifecycle <> 'ready' AND EXISTS (SELECT 1 FROM (SELECT NEW.article_json AS body UNION ALL SELECT CAST(value AS TEXT) FROM json_tree(CASE WHEN json_valid(NEW.article_json) THEN NEW.article_json ELSE 'null' END) WHERE type = 'text') text_ref WHERE instr(text_ref.body, article_image.id) > 0))
BEGIN SELECT RAISE(ABORT, 'article_image_unavailable'); END;
--> statement-breakpoint
CREATE TRIGGER published_articles_image_reference_update AFTER UPDATE OF workspace_id, article_json ON published_articles
BEGIN UPDATE article_image SET last_referenced_at = max(coalesce(last_referenced_at, 0), unixepoch()), referenced = 1
WHERE workspace_id = NEW.workspace_id AND lifecycle = 'ready' AND EXISTS (SELECT 1 FROM (SELECT NEW.article_json AS body UNION ALL SELECT CAST(value AS TEXT) FROM json_tree(CASE WHEN json_valid(NEW.article_json) THEN NEW.article_json ELSE 'null' END) WHERE type = 'text') text_ref WHERE instr(text_ref.body, article_image.id) > 0); END;
--> statement-breakpoint
CREATE TRIGGER published_articles_image_detach_update BEFORE UPDATE OF workspace_id, article_json ON published_articles
BEGIN UPDATE article_image SET last_referenced_at = max(coalesce(last_referenced_at, 0), unixepoch())
WHERE workspace_id = OLD.workspace_id AND lifecycle = 'ready' AND EXISTS (SELECT 1 FROM (SELECT OLD.article_json AS body UNION ALL SELECT CAST(value AS TEXT) FROM json_tree(CASE WHEN json_valid(OLD.article_json) THEN OLD.article_json ELSE 'null' END) WHERE type = 'text') text_ref WHERE instr(text_ref.body, article_image.id) > 0); END;
--> statement-breakpoint
CREATE TRIGGER published_articles_image_detach_delete BEFORE DELETE ON published_articles
BEGIN UPDATE article_image SET last_referenced_at = max(coalesce(last_referenced_at, 0), unixepoch())
WHERE workspace_id = OLD.workspace_id AND lifecycle = 'ready' AND EXISTS (SELECT 1 FROM (SELECT OLD.article_json AS body UNION ALL SELECT CAST(value AS TEXT) FROM json_tree(CASE WHEN json_valid(OLD.article_json) THEN OLD.article_json ELSE 'null' END) WHERE type = 'text') text_ref WHERE instr(text_ref.body, article_image.id) > 0); END;
--> statement-breakpoint
UPDATE article_image SET referenced = 1, last_referenced_at = max(coalesce(last_referenced_at, 0), unixepoch())
WHERE EXISTS (SELECT 1 FROM article_image_reference_text r WHERE r.workspace_id = article_image.workspace_id AND instr(r.body, article_image.id) > 0);
