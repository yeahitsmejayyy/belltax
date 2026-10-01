import type { DocumentView } from "@app/schema";

// POST /api/documents (apps/server/src/rest/documents.ts): multipart, with progress. XHR because fetch can't
// report upload progress. Errors come back as { error } and are already written for the client.

export type UploadFields = { engagementId: string; requestId?: string; kind?: string; personId?: string };

export function uploadDocument(fields: UploadFields, file: File, onProgress: (fraction: number) => void): Promise<DocumentView> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) if (v) form.append(k, v);
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.response as DocumentView);
      const message = (xhr.response as { error?: string } | null)?.error;
      reject(new Error(message ?? "The upload didn't finish. Try again."));
    };
    xhr.onerror = () => reject(new Error("The connection dropped. Check you're online and try again."));
    xhr.send(form);
  });
}
