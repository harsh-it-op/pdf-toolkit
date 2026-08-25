import { Link } from "react-router-dom";
import { ArrowRight, Minimize2, Combine, Scissors, Shield, FileText } from "lucide-react";
import { ToolCard } from "@/components/ToolCard";
import { CATEGORIES, TOOLS } from "@/lib/tools";

const FEATURED = TOOLS.filter((t) =>
  ["merge", "split", "compress", "rotate", "organize", "watermark", "page-numbers", "metadata"].includes(t.id)
);

export function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 sm:pb-16 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
              Real PDF processing — no fakes
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Everything You Need for PDFs
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-600 sm:text-xl">
              Merge, compress, split, convert, edit, and secure PDFs online. Fast,
              private, and free for basic use. Files are processed on the server and
              auto-deleted when you're done.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/merge" className="btn-primary px-5 py-3 text-base">
                Choose a PDF tool
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/compress" className="btn-secondary px-5 py-3 text-base">
                <Minimize2 className="h-4 w-4" />
                Compress PDF
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={Minimize2} label="Compress" />
            <Stat icon={Combine} label="Merge" />
            <Stat icon={Scissors} label="Split" />
            <Stat icon={Shield} label="Secure" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Most popular tools
            </h2>
            <p className="mt-1 text-slate-600">
              Get started with the tools people use most.
            </p>
          </div>
          <Link to="/merge" className="hidden text-sm font-medium text-brand-700 hover:underline sm:inline">
            See all tools →
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED.map((t) => (
            <ToolCard key={t.id} tool={t} />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              All tools
            </h2>
            <p className="mt-1 text-slate-600">Browse by category. More tools ship every release.</p>
          </div>
        </div>

        <div className="mt-8 space-y-12">
          {CATEGORIES.map((cat) => {
            const items = TOOLS.filter((t) => t.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat} id={cat.toLowerCase().replace(/\s+/g, "-")}>
                <h3 className="text-lg font-semibold text-slate-900">{cat}</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((t) => (
                    <ToolCard key={t.id} tool={t} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <ValueProp
            icon={FileText}
            title="No fake processing"
            body="Every tool uses a real PDF engine. If a file can't be processed, you'll see a clear message — not a fake success screen."
          />
          <ValueProp
            icon={Shield}
            title="Files auto-expire"
            body="Uploaded files are deleted after a short TTL. We never store PDFs longer than necessary."
          />
          <ValueProp
            icon={Minimize2}
            title="Honest compression"
            body="Size reduction is measured from your real input and output. We never fabricate percentages."
          />
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label }: { icon: typeof Minimize2; label: string }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="grid h-9 w-9 place-items-center rounded-md bg-brand-50 text-brand-600">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
  );
}

function ValueProp({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Minimize2;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-5">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-3 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p>
    </div>
  );
}
