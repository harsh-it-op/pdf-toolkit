/** Format helpers. Kept tiny — no Intl gymnastics beyond what we actually need. */

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  return `${n.toFixed(1)}%`;
}
