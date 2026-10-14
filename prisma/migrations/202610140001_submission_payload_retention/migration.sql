-- Proposed retention candidate only: policy approval is required before deployment.
-- Match retention.ts literally so PostgreSQL can prove the partial predicate.
-- Cleared history drops out of this index instead of being scanned on every completion.
CREATE INDEX "UserSubmission_retention_payload_idx"
ON "app"."UserSubmission" ("userId", "createdAt", "id")
WHERE status NOT IN ('QUEUED', 'RUNNING') AND "completedAt" IS NOT NULL
  AND (code <> '' OR result IS NOT NULL);
