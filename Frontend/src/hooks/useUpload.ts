import { useCallback, useState } from "react";
import { api, APIError, type UploadedFile } from "@/lib/api";

export interface UploadItem extends UploadedFile {
  /** 0..100 while uploading, 100 once done. */
  uploadProgress: number;
  uploading: boolean;
}

/** Manages a list of files mid-upload. Useful for Merge (multiple) and Compress/Split (single). */
export function useUpload() {
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [error, setError] = useState<APIError | null>(null);

  const add = useCallback(async (newFiles: File[]) => {
    setError(null);
    for (const f of newFiles) {
      const tempId = `${f.name}-${f.size}-${Date.now()}`;
      setFiles((prev) => [
        ...prev,
        {
            id: tempId,
            name: f.name,
            size: f.size,
            pages: 0,
            uploadProgress: 0,
            uploading: true,
          },
      ]);
      try {
        const uploaded = await api.upload(f, (pct) => {
          setFiles((prev) =>
            prev.map((it) =>
              it.id === tempId ? { ...it, uploadProgress: pct } : it
            )
          );
        });
        setFiles((prev) =>
          prev.map((it) =>
            it.id === tempId
              ? { ...uploaded, uploadProgress: 100, uploading: false }
              : it
          )
        );
      } catch (e) {
        const err = e instanceof APIError ? e : new APIError("Upload failed", "UPLOAD_FAILED", 0);
        setError(err);
        setFiles((prev) => prev.filter((it) => it.id !== tempId));
      }
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    const it = files.find((f) => f.id === id);
    if (it && !it.uploading && it.id.length === 32) {
      // Real server id (32 hex chars from the backend). Best-effort delete.
      try {
        await api.deleteFile(it.id);
      } catch {
        /* fine — TTL will clean it up */
      }
    }
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, [files]);

  const reset = useCallback(() => {
    setFiles([]);
    setError(null);
  }, []);

  return { files, add, remove, reset, error };
}
