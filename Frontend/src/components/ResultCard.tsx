import { Download, CheckCircle2 } from "lucide-react";
import { formatBytes, formatPercent } from "@/lib/format";

export interface CompressResult {
  kind: "compress";
  file_id: string;
  input_size: number;
  output_size: number;
  reduction_percent: number;
  pages: number;
  level: string;
}

export interface SplitPart {
  file_id: string;
  name: string;
  size: number;
}

export interface SplitResult {
  kind: "split";
  parts: SplitPart[];
  total_pages: number;
}

export interface MergeResult {
  kind: "merge";
  file_id: string;
  size: number;
  pages: number;
}

export interface SingleFileResult {
  kind: "rotate" | "organize" | "watermark" | "page_numbers" | "metadata";
  file_id: string;
  size: number;
  pages: number;
  /** Present only for rotate. */
  angle?: number;
}

export type OperationResult =
  | CompressResult
  | SplitResult
  | MergeResult
  | SingleFileResult;

export function ResultCard({ result, downloadBase }: { result: OperationResult; downloadBase: string }) {
  if (result.kind === "rotate" || result.kind === "organize" || result.kind === "watermark" ||
      result.kind === "page_numbers" || result.kind === "metadata") {
    return <SingleResult result={result} downloadBase={downloadBase} />;
  }
  if (result.kind === "compress") {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 text-brand-700">
          <CheckCircle2 className="h-5 w-5" />
          <h3 className="text-base font-semibold">Compression complete</h3>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Original" value={formatBytes(result.input_size)} />
          <Stat label="Compressed" value={formatBytes(result.output_size)} />
          <Stat
            label="Reduction"
            value={formatPercent(result.reduction_percent)}
            tone={result.reduction_percent > 0 ? "good" : "neutral"}
          />
          <Stat label="Pages" value={String(result.pages)} />
        </dl>
        <div className="mt-6">
          <a
            href={`${downloadBase}/${result.file_id}/download?name=compressed.pdf`}
            download="compressed.pdf"
            className="btn-primary"
          >
            <Download className="h-4 w-4" />
            Download compressed PDF
          </a>
        </div>
      </div>
    );
  }

  if (result.kind === "merge") {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-2 text-brand-700">
          <CheckCircle2 className="h-5 w-5" />
          <h3 className="text-base font-semibold">Merge complete</h3>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Pages" value={String(result.pages)} />
          <Stat label="Size" value={formatBytes(result.size)} />
        </dl>
        <div className="mt-6">
          <a
            href={`${downloadBase}/${result.file_id}/download?name=merged.pdf`}
            download="merged.pdf"
            className="btn-primary"
          >
            <Download className="h-4 w-4" />
            Download merged PDF
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 text-brand-700">
        <CheckCircle2 className="h-5 w-5" />
        <h3 className="text-base font-semibold">Split complete</h3>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {result.parts.length} part{result.parts.length === 1 ? "" : "s"} from {result.total_pages} page
        {result.total_pages === 1 ? "" : "s"}.
      </p>
      <ul className="mt-4 divide-y divide-slate-100">
        {result.parts.map((p) => (
          <li key={p.file_id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
              <p className="text-xs text-slate-500">{formatBytes(p.size)}</p>
            </div>
            <a
              href={`${downloadBase}/${p.file_id}/download?name=${encodeURIComponent(p.name)}`}
              download={p.name}
              className="btn-secondary"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SINGLE_TITLES: Record<SingleFileResult["kind"], string> = {
  rotate: "Rotation complete",
  organize: "Reorder complete",
  watermark: "Watermark complete",
  page_numbers: "Page numbers added",
  metadata: "Metadata saved",
};

const SINGLE_DL_NAME: Record<SingleFileResult["kind"], string> = {
  rotate: "rotated.pdf",
  organize: "organized.pdf",
  watermark: "watermarked.pdf",
  page_numbers: "page_numbers.pdf",
  metadata: "metadata.pdf",
};

function SingleResult({ result, downloadBase }: { result: SingleFileResult; downloadBase: string }) {
  const title = SINGLE_TITLES[result.kind];
  const dlName = SINGLE_DL_NAME[result.kind];
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 text-brand-700">
        <CheckCircle2 className="h-5 w-5" />
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Pages" value={String(result.pages)} />
        <Stat label="Size" value={formatBytes(result.size)} />
        {result.kind === "rotate" && result.angle !== undefined && (
          <Stat label="Angle" value={`${result.angle}°`} />
        )}
      </dl>
      <div className="mt-6">
        <a
          href={`${downloadBase}/${result.file_id}/download?name=${encodeURIComponent(dlName)}`}
          download={dlName}
          className="btn-primary"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </a>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "neutral";
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={`mt-1 text-lg font-semibold ${
          tone === "good" ? "text-brand-700" : "text-slate-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
