-- Migration: 002_add_plan_column
-- Adds a billing plan to each user. Defaults to "free" for all existing users.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
        CHECK (plan IN ('free', 'starter', 'pro', 'business'));
