import { Link } from "react-router-dom";
import { FileText } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="space-y-3">
          <Link to="/" className="flex items-center gap-2 text-slate-900">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
              <FileText className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">PDFForge</span>
          </Link>
          <p className="text-sm text-slate-600">
            Merge, compress, split, convert, edit, and secure PDFs. Fast, private, and free for basic use.
          </p>
        </div>
        <FooterColumn
          title="Tools"
          links={[
            { label: "Merge PDF", to: "/merge" },
            { label: "Split PDF", to: "/split" },
            { label: "Compress PDF", to: "/compress" },
          ]}
        />
        <FooterColumn
          title="Account"
          links={[
            { label: "Log in", to: "/login" },
            { label: "Sign up", to: "/signup" },
            { label: "Pricing", to: "/pricing" },
          ]}
        />
        <FooterColumn
          title="Company"
          links={[
            { label: "About", to: "/about" },
            { label: "Contact", to: "/contact" },
            { label: "Privacy", to: "/privacy" },
          ]}
        />
      </div>
      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} PDFForge. All rights reserved.</span>
          <span>Built with real PDF processing — no fakes.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to} className="text-sm text-slate-600 hover:text-slate-900">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
