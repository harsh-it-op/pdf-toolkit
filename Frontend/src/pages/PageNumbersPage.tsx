import { useEffect, useState } from "react";
import clsx from "clsx";
import { Hash } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { UploadDropzone } from "@/components/UploadDropzone";
import { FileItem } from "@/components/FileItem";
import { ProgressBar } from "@/components/ProgressBar";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ResultCard, type SingleFileResult } from "@/components/ResultCard";
import { useUpload } from "@/hooks/useUpload";
import { useJob } from "@/hooks/useJob";
import { api, APIError } from "@/lib/api";

const STEPS = ["Upload PDF", "Choose position", "Stamp", "Result"];

type Position = "bottom-center" | "bottom-right" | "top-right";

const POSITIONS: { value: Position; title: string; description: string }[] = [
  { value: "bottom-center", title: "Bottom center", description: "Standard footer placement." },
  { value: "bottom-right", title: "Bottom right", description: "Subtle, off-axis placement." },
  { value: "top-right", title: "Top right", description: "Header placement." },
];

export function PageNumbersPage() {
  const { files, add, remove, error: uploadError } = useUpload();
  const file = files[0];
  const [position, setPosition] = useState<Position>("bottom-center");
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

  async function startStamp() {
    if (!file || file.uploading) return;
    setSubmitError(null);
    try {
      const r = await api.pageNumbers(file.id, position);
      setJobId(r.job_id);
    } catch (e) {
      setSubmitError(e instanceof APIError ? e : new APIError("Failed to start", "INTERNAL", 0));
    }
  }

  return (
    <ToolPageLayout
      title="Add Page Numbers"
      description="Stamp page numbers on every page. Choose a position below."
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
            <p className="block text-sm font-medium text-slate-900">Position</p>
            <div className="mt-3 grid gap-2">
              {POSITIONS.map((opt) => {
                const active = opt.value === position;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPosition(opt.value)}
                    aria-pressed={active}
                    className={clsx(
                      "flex items-start gap-3 rounded-lg border p-3 text-left transition",
                      active
                        ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <span
                      className={clsx(
                        "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                        active ? "border-brand-600 bg-brand-600" : "border-slate-300"
                      )}
                    >
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{opt.title}</span>
                      <span className="block text-xs text-slate-500">{opt.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {submitError && <ErrorAlert message={submitError.message} code={submitError.code} />}

          <div className="flex gap-3">
            <button onClick={startStamp} className="btn-primary" disabled={file.uploading}>
              <Hash className="h-4 w-4" />
              Add page numbers
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
            Stamping page numbers on every page on the server.
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
