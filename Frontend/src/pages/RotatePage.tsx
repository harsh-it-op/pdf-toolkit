import { useEffect, useState } from "react";
import clsx from "clsx";
import { RotateCw } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { UploadDropzone } from "@/components/UploadDropzone";
import { FileItem } from "@/components/FileItem";
import { ProgressBar } from "@/components/ProgressBar";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ResultCard, type SingleFileResult } from "@/components/ResultCard";
import { useUpload } from "@/hooks/useUpload";
import { useJob } from "@/hooks/useJob";
import { api, APIError } from "@/lib/api";

const STEPS = ["Upload PDF", "Choose rotation", "Rotate", "Result"];

type Angle = 90 | 180 | 270;

const ANGLE_OPTIONS: { value: Angle; title: string; description: string }[] = [
  { value: 90, title: "Rotate 90° clockwise", description: "Portrait → landscape (right)." },
  { value: 180, title: "Rotate 180°", description: "Flip upside down." },
  { value: 270, title: "Rotate 90° counter-clockwise", description: "Portrait → landscape (left)." },
];

/**
 * Parse a comma-separated 1-based page list ("1,3,5-7"). Returns null on empty
 * or "all" — which the backend treats as rotate every page.
 */
function parsePages(spec: string): number[] | null {
  const s = spec.trim().toLowerCase();
  if (!s || s === "all") return null;
  const out: number[] = [];
  for (const part of s.split(",")) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes("-")) {
      const [a, b] = p.split("-").map((x) => parseInt(x.trim(), 10));
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 1 || b < a) return [];
      for (let i = a; i <= b; i++) out.push(i);
    } else {
      const n = parseInt(p, 10);
      if (!Number.isFinite(n) || n < 1) return [];
      out.push(n);
    }
  }
  return out;
}

export function RotatePage() {
  const { files, add, remove, error: uploadError } = useUpload();
  const file = files[0];
  const [angle, setAngle] = useState<Angle>(90);
  const [pages, setPages] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<APIError | null>(null);
  const job = useJob(jobId);

  useEffect(() => {
    setJobId(null);
    setSubmitError(null);
  }, [file?.id]);

  const parsedPages = parsePages(pages);
  const pagesValid = parsedPages === null || (Array.isArray(parsedPages) && parsedPages.length > 0);

  const step: 1 | 2 | 3 | 4 = !file
    ? 1
    : !jobId
      ? 2
      : job.status === "completed"
        ? 4
        : 3;

  async function startRotate() {
    if (!file || file.uploading || !pagesValid) return;
    setSubmitError(null);
    try {
      const r = await api.rotate(file.id, angle, parsedPages);
      setJobId(r.job_id);
    } catch (e) {
      setSubmitError(e instanceof APIError ? e : new APIError("Failed to start", "INTERNAL", 0));
    }
  }

  return (
    <ToolPageLayout
      title="Rotate PDF"
      description="Rotate pages by 90°, 180°, or 270°. Apply to all pages or a chosen subset."
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
            <p className="block text-sm font-medium text-slate-900">Rotation angle</p>
            <div className="mt-3 grid gap-2">
              {ANGLE_OPTIONS.map((opt) => {
                const active = opt.value === angle;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAngle(opt.value)}
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

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label htmlFor="pages" className="block text-sm font-medium text-slate-900">
              Pages (optional)
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Leave blank or type <code className="rounded bg-slate-100 px-1">all</code> to rotate every page.
              Otherwise list pages to rotate: <code className="rounded bg-slate-100 px-1">1,3,5-7</code>.
            </p>
            <input
              id="pages"
              type="text"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              className="input mt-3"
              placeholder="all"
            />
            {!pagesValid && (
              <p className="mt-2 text-xs text-red-600">Could not parse page list.</p>
            )}
          </div>

          {submitError && <ErrorAlert message={submitError.message} code={submitError.code} />}

          <div className="flex gap-3">
            <button
              onClick={startRotate}
              className="btn-primary"
              disabled={file.uploading || !pagesValid}
            >
              <RotateCw className="h-4 w-4" />
              Rotate PDF
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
            Rotating your PDF on the server. This is fast for typical documents.
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
