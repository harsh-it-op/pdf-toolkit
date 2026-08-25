import { AlertCircle } from "lucide-react";

export function ErrorAlert({ message, code }: { message: string; code?: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {code && <p className="text-xs font-medium uppercase tracking-wide text-red-700">{code}</p>}
        <p className="leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
