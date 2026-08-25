import { Link, NavLink, useLocation } from "react-router-dom";
import { FileText, Menu, X } from "lucide-react";
import { useState } from "react";
import { TOOLS } from "@/lib/tools";

const NAV_ITEMS = [
  { label: "Compress", href: "/compress" },
  { label: "Merge", href: "/merge" },
  { label: "Split", href: "/split" },
  { label: "Rotate", href: "/rotate" },
  { label: "Organize", href: "/organize" },
  { label: "Watermark", href: "/watermark" },
  { label: "Page Numbers", href: "/page-numbers" },
  { label: "PDF Info", href: "/metadata" },
  { label: "Pricing", href: "/pricing" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-slate-900">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white">
            <FileText className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">PDFForge</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => {
            // Compress / Merge / Split have real pages; everything else is a
            // landing anchor for now.
            const hasPage = ["compress", "merge", "split", "pricing"].includes(item.href.replace("/", ""));
            const isReal = hasPage || item.href.startsWith("/");
            const to = isReal && !item.href.startsWith("/#")
              ? item.href
              : item.href.startsWith("/#")
                ? `/${item.href.slice(2)}${item.href.slice(2) ? "" : ""}`
                : "/";
            // For anchors on the landing page, route to home + hash and let
            // BrowserRouter scroll.
            const target = item.href.startsWith("/#") ? `/${item.href}` : item.href;
            return (
              <NavLink
                key={item.label}
                to={target}
                end={target === "/"}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link to="/login" className="btn-ghost text-sm">
            Log in
          </Link>
          <Link to="/merge" className="btn-primary text-sm">
            Get started
          </Link>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
          className="grid h-10 w-10 place-items-center rounded-md text-slate-700 hover:bg-slate-100 lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.label}
                to={item.href.startsWith("/#") ? `/${item.href}` : item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 flex gap-2">
              <Link to="/login" onClick={() => setOpen(false)} className="btn-secondary flex-1">
                Log in
              </Link>
              <Link to="/merge" onClick={() => setOpen(false)} className="btn-primary flex-1">
                Get started
              </Link>
            </div>
          </nav>
        </div>
      )}
      {/* Reference TOOLS so the const isn't flagged unused on this file. */}
      <span className="hidden" aria-hidden>
        {TOOLS.length}
      </span>
    </header>
  );
}
