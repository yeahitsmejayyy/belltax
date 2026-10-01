// A tRPC error as one sentence. Input validation comes back as zod's issue list in JSON; show its first message.
export function serverMessage(e: unknown, fallback = "That didn't save. Try again."): string {
  const raw = e instanceof Error ? e.message : "";
  if (!raw) return fallback;
  try {
    const issues = JSON.parse(raw) as { message?: string }[];
    if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
  } catch {
    /* a plain sentence already */
  }
  return raw;
}
