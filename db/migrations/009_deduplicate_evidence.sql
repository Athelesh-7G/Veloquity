-- =============================================================
-- 009_deduplicate_evidence.sql
-- Remove duplicate evidence rows caused by repeated pipeline runs.
-- Keeps only the most recently inserted row (MAX id) per unique theme.
-- Adds a UNIQUE constraint on theme to prevent future duplicates.
-- Safe to run multiple times — DELETE and DO $$ block are both idempotent.
-- =============================================================

-- Step 1: Delete duplicate rows, keeping only the highest id per theme
DELETE FROM evidence
WHERE id NOT IN (
    SELECT MAX(id)
    FROM evidence
    GROUP BY theme
);

-- Step 2: Add UNIQUE constraint on theme (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'evidence_theme_unique'
    ) THEN
        ALTER TABLE evidence
        ADD CONSTRAINT evidence_theme_unique UNIQUE (theme);
    END IF;
END $$;
