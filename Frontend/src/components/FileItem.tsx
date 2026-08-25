import { FileText, X } from "lucide-react";
import { formatBytes } from "@/lib/format";

interface Props {
  name: string;
  size?: number;
  pages?: number;
  onRemove?: () => void;
  busy?: boolean;
}

export function FileItem({ name, size, pages, onRemove, busy = false }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600">
        <FileText className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        <p className="text-xs text-slate-500">
          {size !== undefined && formatBytes(size)}
          {pages !== undefined && size !== undefined && " · "}
          {pages !== undefined && `${pages} page${pages === 1 ? "" : "s"}`}
        </p>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          aria-label={`Remove ${name}`}
          className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
