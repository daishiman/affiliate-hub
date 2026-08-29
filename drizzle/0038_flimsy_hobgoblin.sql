ALTER TABLE `guideline_references` ADD `re_evaluated_sha256` text;--> statement-breakpoint
ALTER TABLE `guideline_references` ADD `re_evaluated_at` text;--> statement-breakpoint
UPDATE `guideline_references`
SET
  `re_evaluated_sha256` = `source_sha256`,
  `re_evaluated_at` = `source_fetched_at`
WHERE
  `source_sha256` IS NOT NULL
  AND (
    `previous_source_sha256` IS NULL
    OR `previous_source_sha256` = `source_sha256`
  );
