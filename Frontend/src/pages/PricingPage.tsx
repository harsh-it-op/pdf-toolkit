import { Link } from "react-router-dom";
import { Check } from "lucide-react";

interface Plan {
  name: string;
  price: string;
  description: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0",
    description: "For occasional use.",
    features: [
      "Daily processing limits",
      "Files up to 100 MB",
      "Standard processing speed",
      "Tools that are live today",
    ],
    cta: { label: "Get started", href: "/merge" },
  },
  {
    name: "Pro",
    price: "$9",
    description: "For power users.",
    features: [
      "Higher daily limits",
      "Larger files",
      "Batch processing",
      "Faster processing speed",
      "Early access to new tools",
    ],
    cta: { label: "Start free trial", href: "/signup" },
    highlighted: true,
  },
  {
    name: "Business",
    price: "Contact",
    description: "For teams and integrations.",
    features: [
      "Higher limits",
      "API access",
      "Team management",
      "Usage analytics",
      "Priority support",
    ],
    cta: { label: "Contact sales", href: "/contact" },
  },
];

export function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Simple pricing
        </h1>
        <p className="mt-2 text-slate-600">
          Start free. Upgrade when you need more.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`card flex flex-col p-6 ${
              p.highlighted ? "ring-2 ring-brand-600" : ""
            }`}
          >
            <h2 className="text-lg font-semibold text-slate-900">{p.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{p.description}</p>
            <p className="mt-4 text-3xl font-bold text-slate-900">
              {p.price}
              {p.price !== "Contact" && (
                <span className="text-base font-medium text-slate-500"> /mo</span>
              )}
            </p>
            <ul className="mt-6 flex-1 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to={p.cta.href}
              className={p.highlighted ? "btn-primary mt-6 w-full" : "btn-secondary mt-6 w-full"}
            >
              {p.cta.label}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
