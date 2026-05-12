-- BA decision 12/05/2026: remove the project-approval workflow.
-- TCHC (ADMIN_HC) creates projects directly; no PENDING → APPROVED gate.
-- The "approvalInfo" JSONB column is no longer read or written by any code.

ALTER TABLE "projects" DROP COLUMN IF EXISTS "approvalInfo";
