import { useEffect, useState } from "react";
import { Combine, GripVertical, Trash2 } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { UploadDropzone } from "@/components/UploadDropzone";
import { FileItem } from "@/components/FileItem";
import { ProgressBar } from "@/components/ProgressBar";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ResultCard, type MergeResult } from "@/components/ResultCard";
import { useUpload, type UploadItem } from "@/hooks/useUpload";
import { useJob } from "@/hooks/useJob";
import { api, APIError } from "@/lib/api";

const STEPS = ["Upload PDFs", "Reorder", "Merge", "Result"];

export function MergePage() {
  const { files, add, remove, error: uploadError } = useUpload();
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<APIError | null>(null);
  const job = useJob(jobId);
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    // Keep the visible order in sync with uploads + removals.
    setOrder((prev) => {
      const ids = files.map((f) => f.id);
      const next = prev.filter((id) => ids.includes(id));
      for (const id of ids) if (!next.includes(id)) next.push(id);
      return next;
    });
  }, [files]);

  useEffect(() => {
    setJobId(null);
    setSubmitError(null);
  }, [order.length]);

  const ordered = order
    .map((id) => files.find((f) => f.id === id))
    .filter((f): f is UploadItem => Boolean(f));
  const allReady = ordered.length >= 2 && ordered.every((f) => !f.uploading);

  const step: 1 | 2 | 3 | 4 = ordered.length === 0
    ? 1
    : !jobId
      ? 2
      : job.status === "completed"
        ? 4
        : 3;

  function move(id: string, dir: -1 | 1) {
    setOrder((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function startMerge() {
    if (!allReady) return;
    setSubmitError(null);
    try {
      const r = await api.merge(ordered.map((f) => f.id));
      setJobId(r.job_id);
    } catch (e) {
      setSubmitError(e instanceof APIError ? e : new APIError("Failed to start", "INTERNAL", 0));
    }
  }

  return (
    <ToolPageLayout
      title="Merge PDF"
      description="Combine multiple PDFs into a single file. Drag to reorder them before merging."
      step={step}
      steps={STEPS}
    >
      {step === 1 && (
        <div className="space-y-3">
          <UploadDropzone
            multiple
            onFiles={(fs) => void add(fs)}
            hint="Add at least 2 PDFs. Up to 100 MB each."
          />
          {uploadError && <ErrorAlert message={uploadError.message} code={uploadError.code} />}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <UploadDropzone multiple onFiles={(fs) => void add(fs)} hint="Drop more PDFs to add them." />
          {ordered.length > 0 && (
            <ul className="space-y-2">
              {ordered.map((f, i) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2"
                >
                  <span className="grid h-8 w-8 shrink-0 cursor-grab place-items-center rounded-md text-slate-400">
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <span className="w-6 text-center text-sm font-medium text-slate-500">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <FileItem name={f.name} size={f.size} pages={f.pages} />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(f.id, -1)}
                      disabled={i === 0}
                      aria-label={`Move ${f.name} up`}
                      className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(f.id, 1)}
                      disabled={i === ordered.length - 1}
                      aria-label={`Move ${f.name} down`}
                      className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(f.id)}
                      aria-label={`Remove ${f.name}`}
                      className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {submitError && <ErrorAlert message={submitError.message} code={submitError.code} />}

          <div className="flex items-center gap-3">
            <button onClick={startMerge} className="btn-primary" disabled={!allReady}>
              <Combine className="h-4 w-4" />
              Merge {ordered.length} PDF{ordered.length === 1 ? "" : "s"}
            </button>
            {!allReady && ordered.length > 0 && (
              <span className="text-sm text-slate-500">Waiting for uploads to finish…</span>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-6">
          <ProgressBar value={job.progress} label={job.stage || "Working"} />
          <p className="mt-3 text-sm text-slate-600">
            Merging your PDFs on the server. Page order is preserved exactly as you set it.
          </p>
          {job.error && <div className="mt-4"><ErrorAlert message={job.error.message} code={job.error.code} /></div>}
        </div>
      )}

      {step === 4 && job.status === "completed" && job.result && (
        <ResultCard result={job.result as MergeResult} downloadBase="/api/files" />
      )}
    </ToolPageLayout>
  );
}
