import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { now, UPLOAD_MAX_BYTES } from "@app/schema";
import { z } from "zod";
import { documentFor, engagementFor } from "../access";
import { runtime } from "../db/client";
import { appendEvent, recordView } from "../events";
import { resolveUser, type SessionUser, type Surface } from "../identity";
import { DOCUMENT_COLUMNS, toDocumentView, type DocumentRow } from "../routes/document";
import { demoPdf } from "../db/seed/pdf";

// The REST escape hatch: file bytes don't belong in tRPC. Same identity, same access checks, same events.

const json = (status: number, body: unknown) => Response.json(body, { status });
const fail = (status: number, message: string) => json(status, { error: message });

const Fields = z.object({
  engagementId: z.uuid(),
  requestId: z.uuid().optional(),
  kind: z.string().regex(/^[a-z0-9_]+$/).optional(),
  personId: z.uuid().optional(),
});

// Trust the bytes, not the browser's Content-Type.
function sniff(bytes: Uint8Array): { mime: string; ext: string } | null {
  const b = (i: number) => bytes[i] ?? -1;
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b(0) === 0x89 && ascii(1, 4) === "PNG") return { mime: "image/png", ext: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (ascii(4, 8) === "ftyp" && ["heic", "heix", "mif1", "msf1"].includes(ascii(8, 12))) return { mime: "image/heic", ext: "heic" };
  return null;
}

const cleanName = (name: string, fallback: string) => {
  const base = name.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 120);
  return base || fallback;
};

function guard(req: Request, surface: Surface, devOrigin?: string): Response | SessionUser {
  // CSRF: a cross-site form can't post here. Same origin, or the Vite dev server in demo mode.
  const origin = req.headers.get("origin");
  const allowed = [new URL(req.url).origin, ...(devOrigin && runtime().mode === "demo" ? [devOrigin] : [])];
  if (origin && !allowed.includes(origin)) return fail(403, "Cross-site request refused.");
  const user = resolveUser(req, surface);
  return user ?? fail(401, "Sign-in required.");
}

const fromTrpc = (e: unknown) => {
  if (e instanceof TRPCError) return fail(getHTTPStatusCodeFromError(e), e.message);
  throw e;
};

export const PUBLIC_DEMO_UPLOADS_OFF = "Uploads are off in the public demo, so nothing real can be sent here. Use a sample document instead.";

export async function uploadDocument(req: Request, surface: Surface, devOrigin?: string): Promise<Response> {
  // The hosted demo is open to anyone: refuse before reading a byte, so a real W-2 never reaches it.
  if (runtime().publicDemo) return fail(403, PUBLIC_DEMO_UPLOADS_OFF);
  const user = guard(req, surface, devOrigin);
  if (user instanceof Response) return user;

  let form: Awaited<ReturnType<Request["formData"]>>;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "Send the file as multipart/form-data.");
  }
  const fields = Fields.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!fields.success) return fail(400, "Missing or invalid fields.");
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "Attach a file in the 'file' field.");
  if (file.size === 0) return fail(400, "The file is empty.");
  if (file.size > UPLOAD_MAX_BYTES) return fail(413, "Files can be up to 15 MB.");

  return storeDocument(user, fields.data, new Uint8Array(await file.arrayBuffer()), file.name);
}

type UploadFields = z.infer<typeof Fields>;

// Checks the target (return, request, kind, person), then writes the bytes and the row and logs the event. Shared by a
// real upload and the public demo's sample document, so both take exactly the same path from here on.
async function storeDocument(user: SessionUser, fields: UploadFields, bytes: Uint8Array, filename: string): Promise<Response> {
  const { db, storage } = runtime();
  try {
    const eng = engagementFor(user, fields.engagementId);
    let kind = fields.kind;
    let personId = fields.personId ?? null;
    let supersedes: string | null = null;

    if (fields.requestId) {
      const request = db
        .query<{ engagement_id: string; kind: string; document_kind: string | null; status: string; person_id: string | null }, [string]>(
          "SELECT engagement_id, kind, document_kind, status, person_id FROM requests WHERE id = ?",
        )
        .get(fields.requestId);
      if (!request || request.engagement_id !== eng.id) return fail(404, "Request not found.");
      if (request.kind !== "document") return fail(400, "That request is a question; answer it instead.");
      if (request.status !== "open") return fail(409, "That request is already closed.");
      if (kind && kind !== request.document_kind) return fail(400, `That request is for a ${request.document_kind}.`);
      kind = request.document_kind!;
      personId ??= request.person_id;
      supersedes =
        db
          .query<{ id: string }, [string]>(
            "SELECT id FROM documents WHERE request_id = ? AND status = 'rejected' AND purged_at IS NULL ORDER BY created_at DESC LIMIT 1",
          )
          .get(fields.requestId)?.id ?? null;
    }
    if (!kind) return fail(400, "Say what kind of document this is.");
    if (!db.query("SELECT 1 FROM document_kinds WHERE code = ? AND active = 1").get(kind)) return fail(400, "Unknown document kind.");
    if (personId && !db.query("SELECT 1 FROM return_people WHERE engagement_id = ? AND person_id = ?").get(eng.id, personId)) {
      return fail(400, "That person isn't on this return.");
    }

    const type = sniff(bytes);
    if (!type) return fail(415, "Upload a PDF or a photo (JPEG, PNG, WebP or HEIC).");

    const id = Bun.randomUUIDv7();
    const key = storage.keyFor(id, type.ext);
    storage.put(key, bytes);
    try {
      db.transaction(() => {
        db.run(
          `INSERT INTO documents (id, person_id, engagement_id, tax_year, request_id, supersedes_id, kind, status, filename,
             mime_type, size_bytes, sha256, storage_key, uploaded_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?, ?, ?, ?, ?, ?)`,
          [
            id, personId, eng.id, eng.tax_year, fields.requestId ?? null, supersedes, kind,
            cleanName(filename, `${kind}.${type.ext}`), type.mime, bytes.byteLength,
            new Bun.CryptoHasher("sha256").update(bytes).digest("hex"), key, user.id, now(),
          ],
        );
        appendEvent(db, {
          actor: user,
          type: "document.uploaded",
          subjectType: "document",
          subjectId: id,
          householdId: eng.household_id,
          engagementId: eng.id,
          data: { kind, request_id: fields.requestId ?? null, supersedes_id: supersedes },
        });
      })();
    } catch (e) {
      storage.remove(key); // no orphaned bytes when the row can't be written
      throw e;
    }
    const row = db.query<DocumentRow, [string]>(`SELECT ${DOCUMENT_COLUMNS} FROM documents d JOIN document_kinds k ON k.code = d.kind WHERE d.id = ?`).get(id)!;
    return json(201, toDocumentView(row, user));
  } catch (e) {
    return fromTrpc(e);
  }
}

// The public demo's stand-in for an upload (ticket 46): the server draws an invented one-page PDF, stamped DEMO, for the
// requested kind and stores it exactly as an upload would be. No visitor bytes are ever accepted. Public demo only:
// anywhere else this path doesn't exist.
export const SAMPLE_LIMIT_PER_RETURN = 25;
export async function sampleDocument(req: Request, surface: Surface, devOrigin?: string): Promise<Response> {
  if (runtime().mode !== "demo" || !runtime().publicDemo) return new Response("Not found", { status: 404 });
  const user = guard(req, surface, devOrigin);
  if (user instanceof Response) return user;
  const fields = Fields.safeParse(await req.json().catch(() => null));
  if (!fields.success) return fail(400, "Missing or invalid fields.");
  const { db } = runtime();
  try {
    const eng = engagementFor(user, fields.data.engagementId);
    const sent = db.query<{ n: number }, [string]>("SELECT COUNT(*) AS n FROM documents WHERE engagement_id = ? AND filename LIKE 'sample-%'").get(eng.id)!.n;
    if (sent >= SAMPLE_LIMIT_PER_RETURN) return fail(429, "That's plenty of samples for one return. The demo resets every few hours.");
    const request = fields.data.requestId
      ? db.query<{ document_kind: string | null; person_id: string | null }, [string]>("SELECT document_kind, person_id FROM requests WHERE id = ?").get(fields.data.requestId)
      : null;
    const kind = fields.data.kind ?? request?.document_kind ?? "other";
    const label = db.query<{ label: string }, [string]>("SELECT label FROM document_kinds WHERE code = ?").get(kind)?.label ?? "Document";
    const personId = fields.data.personId ?? request?.person_id ?? null;
    const person = personId ? db.query<{ name: string }, [string]>("SELECT first_name || ' ' || last_name AS name FROM people WHERE id = ?").get(personId)?.name : null;
    const pdf = demoPdf([
      `${label} - tax year ${eng.tax_year}`,
      ...(person ? [`For ${person} (invented)`] : []),
      "A sample sent from the Bell Tax public demo.",
      "Every name and number in the demo is invented.",
    ]);
    return storeDocument(user, fields.data.requestId ? fields.data : { ...fields.data, kind }, pdf, `sample-${kind.replace(/_/g, "-")}.pdf`);
  } catch (e) {
    return fromTrpc(e);
  }
}

export function downloadDocument(req: Request, surface: Surface, documentId: string): Response {
  const user = guard(req, surface);
  if (user instanceof Response) return user;
  try {
    const doc = documentFor(user, documentId);
    const bytes = runtime().storage.get(doc.storage_key!);
    recordView(runtime().db, { actor: user, type: "document.viewed", subjectType: "document", subjectId: doc.id, householdId: doc.household_id, engagementId: doc.engagement_id });
    return new Response(bytes, {
      headers: {
        "Content-Type": doc.mime_type,
        "Content-Disposition": `inline; filename="${cleanName(doc.filename, "document")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return fromTrpc(e);
  }
}
