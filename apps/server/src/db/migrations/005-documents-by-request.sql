-- 005: a request's documents without scanning every document (ticket 35). listRequests asks for each
-- request's latest upload, and the upload endpoint looks for a rejected one to supersede; both filtered
-- on request_id, which nothing indexed. At 10,000 households, engagement.detail spent 18 ms here.
CREATE INDEX IF NOT EXISTS documents_request ON documents (request_id, created_at);
