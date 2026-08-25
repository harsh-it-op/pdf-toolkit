import { useEffect, useState } from "react";
import { Minimize2 } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { UploadDropzone } from "@/components/UploadDropzone";
import { FileItem } from "@/components/FileItem";
import { CompressionSettings, type CompressionLevel } from "@/components/CompressionSettings";
import { ProgressBar } from "@/components/ProgressBar";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ResultCard, type CompressResult } from "@/components/ResultCard";
import { useUpload } from "@/hooks/useUpload";
import { useJob } from "@/hooks/useJob";
import { api, APIError } from "@/lib/api";

const STEPS = ["Upload", "Choose level", "Compress", "Result"];

export function CompressPage() {
  const { files, add, remove, reset, error: uploadError } = useUpload();
  const [level, setLevel] = useState<CompressionLevel>("recommended");
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<APIError | null>(null);
  const job = useJob(jobId);

  const file = files[0];

  useEffect(() => {
    // Reset downstream state when the user changes the file.
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

  async function startCompress() {
    if (!file || file.uploading) return;
    setSubmitError(null);
    try {
      const r = await api.compress(file.id, level);
      setJobId(r.job_id);
    } catch (e) {
      setSubmitError(e instanceof APIError ? e : new APIError("Failed to start", "INTERNAL", 0));
    }
  }

  function startOver() {
    if (file) remove(file.id);
    reset();
    setJobId(null);
  }

  return (
    <ToolPageLayout
      title="Compress PDF"
      description="Reduce a PDF's file size with one of three quality presets."
      step={step}
      steps={STEPS}
    >
      {step === 1 && (
        <div className="space-y-3">
          <UploadDropzone
            onFiles={(fs) => void add(fs)}
            hint="Single PDF, up to 100 MB."
          />
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
          <CompressionSettings value={level} onChange={setLevel} />
          {submitError && <ErrorAlert message={submitError.message} code={submitError.code} />}
          <div className="flex gap-3">
            <button onClick={startCompress} className="btn-primary" disabled={file.uploading}>
              <Minimize2 className="h-4 w-4" />
              Compress PDF
            </button>
            <button onClick={startOver} className="btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-6">
          <ProgressBar value={job.progress} label={job.stage || "Working"} />
          <p className="mt-3 text-sm text-slate-600">
            Compressing your PDF on the server. You can leave this page — your file will be ready when you come back.
          </p>
          {job.error && <div className="mt-4"><ErrorAlert message={job.error.message} code={job.error.code} /></div>}
        </div>
      )}

      {step === 4 && job.status === "completed" && job.result && (
        <div className="space-y-4">
          <ResultCard result={job.result as CompressResult} downloadBase="/api/files" />
          <button onClick={startOver} className="btn-ghost">
            Compress another file
          </button>
        </div>
      )}
    </ToolPageLayout>
  );
}
