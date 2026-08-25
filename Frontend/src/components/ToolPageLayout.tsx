import type { ReactNode } from "react";

interface Props {
  title: string;
  description: string;
  step: 1 | 2 | 3 | 4;
  steps: string[];
  children: ReactNode;
}

const STEP_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: "Upload",
  2: "Configure",
  3: "Process",
  4: "Result",
};

export function ToolPageLayout({ title, description, step, steps, children }: Props) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1 text-slate-600">{description}</p>
      </div>
      <Stepper current={step} steps={steps} />
      <div className="mt-8">{children}</div>
    </div>
  );
}

function Stepper({ current, steps }: { current: number; steps: string[] }) {
  return (
    <ol className="flex items-center gap-3 text-sm">
      {steps.map((label, i) => {
        const idx = (i + 1) as 1 | 2 | 3 | 4;
        const active = idx === current;
        const done = idx < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${
                done
                  ? "bg-brand-600 text-white"
                  : active
                    ? "bg-brand-100 text-brand-700 ring-2 ring-brand-600"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {done ? "✓" : idx}
            </span>
            <span
              className={`font-medium ${
                active ? "text-slate-900" : done ? "text-slate-700" : "text-slate-500"
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-1 h-px w-8 bg-slate-200 sm:w-12" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export const STEP_TITLES = STEP_LABEL;
