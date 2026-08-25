import clsx from "clsx";

export type CompressionLevel = "extreme" | "recommended" | "low";

interface Option {
  id: CompressionLevel;
  title: string;
  description: string;
}

const OPTIONS: Option[] = [
  {
    id: "extreme",
    title: "Extreme compression",
    description: "Smallest file size. May reduce image quality on image-heavy PDFs.",
  },
  {
    id: "recommended",
    title: "Recommended",
    description: "Balanced — noticeable size reduction with good quality.",
  },
  {
    id: "low",
    title: "Low compression / high quality",
    description: "Light optimization. Output stays close to the original.",
  },
];

export function CompressionSettings({
  value,
  onChange,
}: {
  value: CompressionLevel;
  onChange: (v: CompressionLevel) => void;
}) {
  return (
    <div className="grid gap-2">
      {OPTIONS.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
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
  );
}
