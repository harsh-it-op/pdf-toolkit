import { Link } from "react-router-dom";
import type { Tool } from "@/lib/tools";
import { ArrowRight } from "lucide-react";

export function ToolCard({ tool }: { tool: Tool }) {
  const disabled = tool.status === "coming-soon";

  const inner = (
    <div
      className={`card group flex h-full flex-col p-5 transition ${
        disabled
          ? "opacity-70"
          : "hover:-translate-y-0.5 hover:shadow-cardHover"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
          <tool.icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900">{tool.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{tool.description}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        {disabled ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            Coming soon
          </span>
        ) : (
          <span className="text-brand-600 group-hover:underline">Open tool</span>
        )}
        <ArrowRight
          className={`h-4 w-4 transition ${
            disabled ? "text-slate-400" : "text-slate-400 group-hover:translate-x-0.5 group-hover:text-brand-600"
          }`}
        />
      </div>
    </div>
  );

  if (disabled) {
    return (
      <div aria-disabled className="block cursor-not-allowed">
        {inner}
      </div>
    );
  }
  return (
    <Link to={tool.href} className="block focus:outline-none">
      {inner}
    </Link>
  );
}
