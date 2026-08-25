import { useEffect, useState } from "react";
import { Scissors } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { UploadDropzone } from "@/components/UploadDropzone";
import { FileItem } from "@/components/FileItem";
import { ProgressBar } from "@/components/ProgressBar";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ResultCard, type SplitResult } from "@/components/ResultCard";
import { useUpload } from "@/hooks/useUpload";
import { useJob } from "@/hooks/useJob";
import { api, APIError } from "@/lib/api";

const STEPS = ["Upload PDF", "Choose ranges", "Split", "Result"];

export function SplitPage() {
  const { files, add, remove, error: uploadError } = useUpload();
  const file = files[0];
  const [ranges, setRanges] = useState("1-3");
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<APIError | null>(null);
  const job = useJob(jobId);

  useEffect(() => {
    setJobId(null);
    setSubmitError(null);
  }, [file?.id]);

  const step: 1 | 2 | 3 | 4 = !file
    ? 1
    : !jobId
      ? 2
      : job.status === "completed"
        ? 4
        : 3;

  async function startSplit() {
    if (!file || file.uploading) return;
    setSubmitError(null);
    try {
      const r = await api.split(file.id, ranges);
      setJobId(r.job_id);
    } catch (e) {
      setSubmitError(e instanceof APIError ? e : new APIError("Failed to start", "INTERNAL", 0));
    }
  }

  return (
    <ToolPageLayout
      title="Split PDF"
      description="Extract one or more page ranges from a PDF. Each range becomes its own file."
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
            <label htmlFor="ranges" className="block text-sm font-medium text-slate-900">
              Page ranges
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Use a comma-separated list. Examples: <code className="rounded bg-slate-100 px-1">all</code>,{" "}
              <code className="rounded bg-slate-100 px-1">1-3</code>,{" "}
              <code className="rounded bg-slate-100 px-1">1-3,5,7-9</code>.
            </p>
            <input
              id="ranges"
              type="text"
              value={ranges}
              onChange={(e) => setRanges(e.target.value)}
              className="input mt-3"
              placeholder={`1-${file.pages || "N"}`}
            />
            <p className="mt-2 text-xs text-slate-500">
              This PDF has {file.pages} page{file.pages === 1 ? "" : "s"}.
            </p>
          </div>

          {submitError && <ErrorAlert message={submitError.message} code={submitError.code} />}

          <div className="flex gap-3">
            <button onClick={startSplit} className="btn-primary" disabled={file.uploading}>
              <Scissors className="h-4 w-4" />
              Split PDF
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
            Splitting your PDF on the server. Each range becomes a separate file in the result.
          </p>
          {job.error && <div className="mt-4"><ErrorAlert message={job.error.message} code={job.error.code} /></div>}
        </div>
      )}

      {step === 4 && job.status === "completed" && job.result && (
        <ResultCard result={job.result as SplitResult} downloadBase="/api/files" />
      )}
    </ToolPageLayout>
  );
}
