import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";

export function ComingSoonPage({ tool }: { tool: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600">
        <Sparkles className="h-6 w-6" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        {tool} is coming soon
      </h1>
      <p className="mt-2 text-slate-600">
        We don't ship a tool until it actually works. In the meantime, here are the
        tools that are live today.
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link to="/merge" className="btn-primary">
          Try Merge PDF
        </Link>
        <Link to="/compress" className="btn-secondary">
          Try Compress PDF
        </Link>
        <Link to="/" className="btn-ghost">
          <ArrowLeft className="h-4 w-4" />
          Back to all tools
        </Link>
      </div>
    </div>
  );
}
