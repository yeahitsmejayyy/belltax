-- 004: find a subject's events without scanning the log. Recording a view checks for one by the same
-- viewer in the last hour (ticket 32), on every open of a return.
CREATE INDEX IF NOT EXISTS events_subject ON events (subject_id, type, occurred_at);
