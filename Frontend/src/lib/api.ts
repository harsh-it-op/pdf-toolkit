/**
 * API client for the PDFForge backend.
 *
 * Convention: every server response is {success, ...} or {success: false, error}.
 * The backend already validates uploads and translates typed PDF errors into
 * friendly codes — we just surface them.
 */

const API_BASE = "/api";

export class APIError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "APIError";
    this.code = code;
    this.status = status;
  }
}

async function asJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (res.ok && (body as { success?: boolean }).success) {
    return body as T;
  }
  const err = (body as { error?: { code?: string; message?: string } }).error;
  throw new APIError(
    err?.message ?? `Request failed (${res.status})`,
    err?.code ?? "INTERNAL",
    res.status
  );
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  pages: number;
}

export interface JobPublic {
  job_id: string;
  operation: string;
  status: "queued" | "processing" | "completed" | "failed" | "expired";
  progress: number;
  stage: string;
  created_at: number;
  expires_at: number;
  result?: unknown;
  error?: { code: string; message: string };
}

export const api = {
  async health(): Promise<{ success: true; service: string; version: string }> {
    const res = await fetch(`${API_BASE}/health`);
    return asJson(res);
  },

  async upload(file: File, onProgress?: (pct: number) => void): Promise<UploadedFile> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/files/upload`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && body.success) {
            resolve(body.file);
          } else {
            reject(
              new APIError(
                body?.error?.message ?? `Upload failed (${xhr.status})`,
                body?.error?.code ?? "UPLOAD_FAILED",
                xhr.status
              )
            );
          }
        } catch {
          reject(new APIError("Invalid server response", "BAD_RESPONSE", xhr.status));
        }
      };
      xhr.onerror = () => reject(new APIError("Network error", "NETWORK", 0));
      xhr.onabort = () => reject(new APIError("Upload cancelled", "CANCELLED", 0));
      const form = new FormData();
      form.append("file", file);
      xhr.send(form);
    });
  },

  async deleteFile(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/files/${id}`, { method: "DELETE" });
    await asJson(res);
  },

  downloadUrl(id: string, name?: string): string {
    const q = name ? `?name=${encodeURIComponent(name)}` : "";
    return `${API_BASE}/files/${id}/download${q}`;
  },

  async merge(fileIds: string[]): Promise<{ job_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/pdf/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_ids: fileIds }),
    });
    return asJson(res);
  },

  async split(fileId: string, ranges: string): Promise<{ job_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/pdf/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, ranges }),
    });
    return asJson(res);
  },

  async compress(
    fileId: string,
    level: "extreme" | "recommended" | "low"
  ): Promise<{ job_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/pdf/compress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, level }),
    });
    return asJson(res);
  },

  async rotate(
    fileId: string,
    angle: 0 | 90 | 180 | 270,
    pages?: number[] | null
  ): Promise<{ job_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/pdf/rotate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, angle, pages: pages ?? null }),
    });
    return asJson(res);
  },

  async organize(
    fileId: string,
    order: number[]
  ): Promise<{ job_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/pdf/organize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, order }),
    });
    return asJson(res);
  },

  async watermark(
    fileId: string,
    text: string
  ): Promise<{ job_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/pdf/watermark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, text }),
    });
    return asJson(res);
  },

  async pageNumbers(
    fileId: string,
    position: string
  ): Promise<{ job_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/pdf/page-numbers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, position }),
    });
    return asJson(res);
  },

  async metadata(
    fileId: string,
    fields: Record<string, string>
  ): Promise<{ job_id: string; status: string }> {
    const res = await fetch(`${API_BASE}/pdf/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId, fields }),
    });
    return asJson(res);
  },

  async readMetadata(fileId: string): Promise<Record<string, string>> {
    const res = await fetch(`${API_BASE}/files/${fileId}/metadata`);
    const body = await asJson<{ success: true; metadata: Record<string, string> }>(res);
    return body.metadata;
  },

  async job(id: string): Promise<{ success: true; job: JobPublic }> {
    const res = await fetch(`${API_BASE}/jobs/${id}`);
    return asJson(res);
  },
};
