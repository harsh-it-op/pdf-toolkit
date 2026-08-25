import { useEffect, useMemo, useState } from "react";
import { Files, ArrowUp, ArrowDown } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { UploadDropzone } from "@/components/UploadDropzone";
import { FileItem } from "@/components/FileItem";
import { ProgressBar } from "@/components/ProgressBar";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ResultCard, type SingleFileResult } from "@/components/ResultCard";
import { useUpload } from "@/hooks/useUpload";
import { useJob } from "@/hooks/useJob";
import { api, APIError } from "@/lib/api";

const STEPS = ["Upload PDF", "Reorder pages", "Organize", "Result"];

/**
 * Parse "1,5,3,2,4" or "1-5" → 1-based list. Returns [] on invalid input.
 */
function parseOrder(spec: string, total: number): number[] {
  const out: number[] = [];
  for (const part of spec.split(",")) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes("-")) {
      const [a, b] = p.split("-").map((x) => parseInt(x.trim(), 10));
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 1 || b > total || b < a) return [];
      for (let i = a; i <= b; i++) out.push(i);
    } else {
      const n = parseInt(p, 10);
      if (!Number.isFinite(n) || n < 1 || n > total) return [];
      out.push(n);
    }
  }
  // The backend requires a permutation of 1..N, no duplicates.
  const seen = new Set<number>();
  for (const n of out) {
    if (seen.has(n)) return [];
    seen.add(n);
  }
  return out;
}

export function OrganizePage() {
  const { files, add, remove, error: uploadError } = useUpload();
  const file = files[0];
  const [order, setOrder] = useState<number[]>([]);
  const [orderText, setOrderText] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<APIError | null>(null);
  const job = useJob(jobId);

  // Initialize order to [1..N] when the file is loaded.
  useEffect(() => {
    if (file && file.pages > 0) {
      setOrder(Array.from({ length: file.pages }, (_, i) => i + 1));
    } else {
      setOrder([]);
    }
    setOrderText("");
    setJobId(null);
    setSubmitError(null);
  }, [file?.id, file?.pages]);

  const totalPages = file?.pages ?? 0;

  const parsed = useMemo(() => (orderText.trim() ? parseOrder(orderText, totalPages) : null), [orderText, totalPages]);
  const effectiveOrder = parsed ?? order;
  const orderValid = effectiveOrder.length === totalPages;

  const step: 1 | 2 | 3 | 4 = !file
    ? 1
    : !jobId
      ? 2
      : job.status === "completed"
        ? 4
        : 3;

  function move(i: number, dir: -1 | 1) {
    setOrder((prev) => {
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function resetToNatural() {
    setOrder(Array.from({ length: totalPages }, (_, i) => i + 1));
    setOrderText("");
  }

  function reverse() {
    setOrder((prev) => [...prev].reverse());
    setOrderText("");
  }

  async function startOrganize() {
    if (!file || file.uploading || !orderValid) return;
    setSubmitError(null);
    try {
      const r = await api.organize(file.id, effectiveOrder);
      setJobId(r.job_id);
    } catch (e) {
      setSubmitError(e instanceof APIError ? e : new APIError("Failed to start", "INTERNAL", 0));
    }
  }

  return (
    <ToolPageLayout
      title="Organize PDF"
      description="Reorder the pages of a PDF. Use the arrows below or type your own order."
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
              <p className="block text-sm font-medium text-slate-900">Page order</p>
              <div className="flex gap-2">
                <button onClick={resetToNatural} className="btn-ghost text-xs">Reset to natural</button>
                <button onClick={reverse} className="btn-ghost text-xs">Reverse</button>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {totalPages} page{totalPages === 1 ? "" : "s"}. Use ↑/↓ to reorder, or type your own order below.
            </p>
            {totalPages > 0 && (
              <ol className="mt-3 max-h-72 space-y-1 overflow-y-auto rounded border border-slate-100 bg-slate-50 p-2">
                {order.map((page, i) => (
                  <li
                    key={`${page}-${i}`}
                    className="flex items-center gap-2 rounded bg-white px-2 py-1.5 text-sm"
                  >
                    <span className="w-8 shrink-0 text-center font-mono text-xs text-slate-400">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-slate-700">Page {page}</span>
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={`Move page ${page} up`}
                      className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === order.length - 1}
                      aria-label={`Move page ${page} down`}
                      className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <label htmlFor="orderText" className="block text-sm font-medium text-slate-900">
              Or type a custom order
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Comma-separated list of page numbers. Must be a permutation of 1..{totalPages}.
              Examples: <code className="rounded bg-slate-100 px-1">5,4,3,2,1</code>,{" "}
              <code className="rounded bg-slate-100 px-1">1,3-5,2</code>.
            </p>
            <input
              id="orderText"
              type="text"
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              className="input mt-3"
              placeholder="leave blank to use the order above"
            />
            {orderText.trim() && !orderValid && (
              <p className="mt-2 text-xs text-red-600">
                Order must contain each page number 1..{totalPages} exactly once.
              </p>
            )}
          </div>

          {submitError && <ErrorAlert message={submitError.message} code={submitError.code} />}

          <div className="flex gap-3">
            <button
              onClick={startOrganize}
              className="btn-primary"
              disabled={file.uploading || !orderValid}
            >
              <Files className="h-4 w-4" />
              Organize PDF
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
            Reordering your pages on the server.
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
