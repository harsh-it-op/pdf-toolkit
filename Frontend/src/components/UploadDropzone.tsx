import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import clsx from "clsx";

interface Props {
  accept?: string;
  multiple?: boolean;
  maxBytes?: number;
  disabled?: boolean;
  hint?: string;
  onFiles: (files: File[]) => void;
}

export function UploadDropzone({
  accept = "application/pdf,.pdf",
  multiple = false,
  maxBytes,
  disabled = false,
  hint,
  onFiles,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(
    (files: File[]) => {
      const ok: File[] = [];
      for (const f of files) {
        const isPdf =
          f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
        if (!isPdf) {
          setError("Only PDF files are accepted.");
          continue;
        }
        if (maxBytes && f.size > maxBytes) {
          setError(`${f.name} is too large. Max is ${Math.round(maxBytes / (1024 * 1024))} MB.`);
          continue;
        }
        ok.push(f);
      }
      if (ok.length) {
        setError(null);
        onFiles(multiple ? ok : [ok[0]]);
      }
    },
    [multiple, maxBytes, onFiles]
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (disabled) return;
          const files = Array.from(e.dataTransfer.files);
          if (files.length) validate(multiple ? files : [files[0]]);
        }}
        disabled={disabled}
        className={clsx(
          "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-white px-6 py-12 text-center transition",
          over
            ? "border-brand-500 bg-brand-50/50"
            : "border-slate-300 hover:border-slate-400",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600">
          <UploadCloud className="h-6 w-6" />
        </span>
        <div>
          <p className="text-base font-medium text-slate-900">
            Drag & drop {multiple ? "your PDFs" : "your PDF"} here
          </p>
          <p className="mt-1 text-sm text-slate-500">
            or{" "}
            <span className="font-medium text-brand-600 underline-offset-2 hover:underline">
              choose a file
            </span>
          </p>
          {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            if (files.length) validate(multiple ? files : [files[0]]);
            e.target.value = "";
          }}
        />
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
