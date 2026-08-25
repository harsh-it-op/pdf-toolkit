import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { UploadDropzone } from "@/components/UploadDropzone";
import { FileItem } from "@/components/FileItem";
import { ProgressBar } from "@/components/ProgressBar";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ResultCard, type SingleFileResult } from "@/components/ResultCard";
import { useUpload } from "@/hooks/useUpload";
import { useJob } from "@/hooks/useJob";
import { api, APIError } from "@/lib/api";

const STEPS = ["Upload PDF", "Edit metadata", "Save", "Result"];

/** The fields the backend accepts (lower-case keys, matches backend get_metadata). */
const FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "title", label: "Title", placeholder: "Quarterly Report" },
  { key: "author", label: "Author", placeholder: "Jane Smith" },
  { key: "subject", label: "Subject", placeholder: "Q3 financial summary" },
  { key: "keywords", label: "Keywords", placeholder: "finance, q3, internal" },
  { key: "creator", label: "Creator", placeholder: "Application that created the original" },
  { key: "producer", label: "Producer", placeholder: "Application that produced the PDF" },
];

export function MetadataPage() {
  const { files, add, remove, error: uploadError } = useUpload();
  const file = files[0];
  const [values, setValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<APIError | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<APIError | null>(null);
  const job = useJob(jobId);

  // Fetch existing metadata when a file is uploaded.
  useEffect(() => {
    if (!file) {
      setValues({});
      setLoaded(false);
      return;
    }
    setLoaded(false);
    setLoadError(null);
    let cancelled = false;
    api
      .readMetadata(file.id)
      .then((meta) => {
        if (cancelled) return;
        const initial: Record<string, string> = {};
        for (const f of FIELDS) initial[f.key] = meta[f.key] ?? "";
        setValues(initial);
        setLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof APIError ? e : new APIError("Could not load metadata", "INTERNAL", 0));
      });
    return () => {
      cancelled = true;
    };
  }, [file?.id]);

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

  // Build the payload of fields that have non-empty trimmed values.
  const payload: Record<string, string> = {};
  for (const f of FIELDS) {
    const v = (values[f.key] ?? "").trim();
    if (v) payload[f.key] = v;
  }
  const canSubmit = !!file && !file.uploading && loaded && Object.keys(payload).length > 0;

  async function startSave() {
    if (!canSubmit) return;
    setSubmitError(null);
    try {
      const r = await api.metadata(file.id, payload);
      setJobId(r.job_id);
    } catch (e) {
      setSubmitError(e instanceof APIError ? e : new APIError("Failed to start", "INTERNAL", 0));
    }
  }

  return (
    <ToolPageLayout
      title="PDF Info / Metadata"
      description="View and edit the metadata (title, author, subject, …) stored in a PDF."
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
            <div className="flex items-center justify-between">
              <p className="block text-sm font-medium text-slate-900">Metadata</p>
              {!loaded && !loadError && (
                <span className="text-xs text-slate-500">Loading current metadata…</span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Empty fields are left unchanged. Only the fields you fill in will be written.
            </p>
            {loadError && (
              <div className="mt-3">
                <ErrorAlert message={loadError.message} code={loadError.code} />
              </div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label
                    htmlFor={`meta-${f.key}`}
                    className="block text-xs font-medium uppercase tracking-wide text-slate-500"
                  >
                    {f.label}
                  </label>
                  <input
                    id={`meta-${f.key}`}
                    type="text"
                    value={values[f.key] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    disabled={!loaded}
                    className="input mt-1"
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
            </div>
          </div>

          {submitError && <ErrorAlert message={submitError.message} code={submitError.code} />}

          <div className="flex gap-3">
            <button
              onClick={startSave}
              className="btn-primary"
              disabled={!canSubmit}
            >
              <Eye className="h-4 w-4" />
              Save metadata
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
            Writing the new metadata on the server.
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
