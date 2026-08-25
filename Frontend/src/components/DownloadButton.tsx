import { Download } from "lucide-react";

interface Props {
  href: string;
  filename?: string;
  label?: string;
}

export function DownloadButton({ href, filename, label = "Download" }: Props) {
  return (
    <a
      href={href}
      download={filename}
      className="btn-primary"
    >
      <Download className="h-4 w-4" />
      {label}
    </a>
  );
}
