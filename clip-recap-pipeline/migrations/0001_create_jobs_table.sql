-- Migration: Create jobs table for persistent job state management
-- This table stores job state, progress, results, and expiry information

CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  created_at TEXT NOT NULL, -- ISO8601 timestamp
  updated_at TEXT NOT NULL, -- ISO8601 timestamp
  expires_at TEXT NOT NULL, -- ISO8601 timestamp
  progress_step TEXT,
  progress_current INTEGER DEFAULT 0,
  progress_total INTEGER DEFAULT 0,
  request_data TEXT NOT NULL, -- JSON string of original request
  results TEXT, -- JSON string of results (when completed)
  error_message TEXT, -- Error details (when failed)
  worker_id TEXT, -- ID of worker processing the job
  started_at TEXT, -- ISO8601 timestamp when processing started
  completed_at TEXT -- ISO8601 timestamp when processing completed
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_expires_at ON jobs(expires_at);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_jobs_expired ON jobs(expires_at) WHERE expires_at < datetime('now');
