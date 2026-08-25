import { useEffect, useState } from "react";
import { Stamp } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { UploadDropzone } from "@/components/UploadDropzone";
import { FileItem } from "@/components/FileItem";
import { ProgressBar } from "@/components/ProgressBar";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ResultCard, type SingleFileResult } from "@/components/ResultCard";
import { useUpload } from "@/hooks/useUpload";
import { useJob } from "@/hooks/useJob";
import { api, APIError } from "@/lib/api";

const STEPS = ["Upload PDF", "Watermark text", "Apply", "Result"];

export function WatermarkPage() {
  const { files, add, remove, error: uploadError } = useUpload();
  const file = files[0];
  const [text, setText] = useState("CONFIDENTIAL");
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<APIError | null>(null);
  const job = useJob(jobId);

  useEffect(() => {
    setJobId(null);
    setSubmitError(null);
  }, [file?.id]);

  const trimmed = text.trim();
  const canSubmit = !!file && !file.uploading && trimmed.length > 0;

  const step: 1 | 2 | 3 | 4 = !file
    ? 1
    : !jobId
      ? 2
      : job.status === "completed"
        ? 4
        : 3;

  async function startWatermark() {
    if (!canSubmit) return;
    setSubmitError(null);
    try {
      const r = await api.watermark(file.id, trimmed);
      setJobId(r.job_id);
    } catch (e) {
      setSubmitError(e instanceof APIError ? e : new APIError("Failed to start", "INTERNAL", 0));
    }
  }

  return (
    <ToolPageLayout
      title="Watermark PDF"
      description="Overlay a diagonal text watermark on every page."
      step={step}
      steps={STEPS}
    >
      {step === 1 && (
        <div className="space-y-3">
          <UploadDropzone onFiles={(fs) => void add(fs)} hint="Single PDF, up to 100 MB." />
          {uploadError && <ErrorAlert message={uploadError.message} code={uploadError.code} />}
        </div>
      )}

      {step === 2 && file && (
        <div className="space-y-6">
          <FileItem
            name={file.name}
            size={file.size}
            pages={file.pages}
            onRemove={() => remove(file.id)}
            busy={file.uploading}
          />

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label htmlFor="watermark" className="block text-sm font-medium text-slate-900">
              Watermark text
            </label>
            <p className="mt-1 text-xs text-slate-500">
              This text will be stamped diagonally on every page. Common choices:{" "}
              <code className="rounded bg-slate-100 px-1">DRAFT</code>,{" "}
              <code className="rounded bg-slate-100 px-1">CONFIDENTIAL</code>,{" "}
              <code className="rounded bg-slate-100 px-1">COPY</code>.
            </p>
            <input
              id="watermark"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="input mt-3"
              placeholder="DRAFT"
              maxLength={64}
            />
            <p className="mt-2 text-xs text-slate-500">{trimmed.length} / 64 characters.</p>
          </div>

          {submitError && <ErrorAlert message={submitError.message} code={submitError.code} />}

          <div className="flex gap-3">
            <button onClick={startWatermark} className="btn-primary" disabled={!canSubmit}>
              <Stamp className="h-4 w-4" />
              Apply watermark
            </button>
            <button onClick={() => remove(file.id)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-6">
          <ProgressBar value={job.progress} label={job.stage || "Working"} />
          <p className="mt-3 text-sm text-slate-600">
            Stamping the watermark on every page on the server.
          </p>
          {job.error && <div className="mt-4"><ErrorAlert message={job.error.message} code={job.error.code} /></div>}
        </div>
      )}

      {step === 4 && job.status === "completed" && job.result && (
        <ResultCard result={job.result as SingleFileResult} downloadBase="/api/files" />
      )}
    </ToolPageLayout>
  );
}
