import type { LucideIcon } from "lucide-react";
import {
  Combine,
  Scissors,
  Minimize2,
  RotateCw,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  Presentation,
  Lock,
  Unlock,
  Crop,
  Hash,
  Stamp,
  Type,
  Pencil,
  Languages,
  Wrench,
  Eye,
  EyeOff,
  Files,
  Crop as CropIcon,
  FileType,
} from "lucide-react";

export type ToolStatus = "ready" | "coming-soon";

export interface Tool {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  status: ToolStatus;
  category: "Organize" | "Compress" | "Convert" | "Edit" | "Security" | "Page tools" | "OCR" | "Other";
}

export const TOOLS: Tool[] = [
  // Organize
  { id: "merge", name: "Merge PDF", description: "Combine PDFs in any order.", href: "/merge", icon: Combine, status: "ready", category: "Organize" },
  { id: "split", name: "Split PDF", description: "Extract one or more page ranges.", href: "/split", icon: Scissors, status: "ready", category: "Organize" },
  { id: "organize", name: "Organize PDF", description: "Reorder pages with drag-and-drop.", href: "/organize", icon: Files, status: "ready", category: "Organize" },
  { id: "delete-pages", name: "Delete Pages", description: "Remove specific pages from a PDF.", href: "/delete-pages", icon: CropIcon, status: "coming-soon", category: "Organize" },
  { id: "extract-pages", name: "Extract Pages", description: "Pull out only the pages you need.", href: "/extract-pages", icon: FileType, status: "coming-soon", category: "Organize" },

  // Compress
  { id: "compress", name: "Compress PDF", description: "Reduce file size with quality presets.", href: "/compress", icon: Minimize2, status: "ready", category: "Compress" },

  // Convert
  { id: "pdf-to-jpg", name: "PDF to JPG", description: "Convert each page to an image.", href: "/pdf-to-jpg", icon: ImageIcon, status: "coming-soon", category: "Convert" },
  { id: "jpg-to-pdf", name: "JPG to PDF", description: "Bundle images into a single PDF.", href: "/jpg-to-pdf", icon: ImageIcon, status: "coming-soon", category: "Convert" },
  { id: "pdf-to-text", name: "PDF to TXT", description: "Extract plain text from a PDF.", href: "/pdf-to-text", icon: FileText, status: "coming-soon", category: "Convert" },
  { id: "pdf-to-docx", name: "PDF to DOCX", description: "Convert a PDF to an editable Word file.", href: "/pdf-to-docx", icon: FileText, status: "coming-soon", category: "Convert" },
  { id: "docx-to-pdf", name: "DOCX to PDF", description: "Convert a Word document to PDF.", href: "/docx-to-pdf", icon: FileText, status: "coming-soon", category: "Convert" },
  { id: "pptx-to-pdf", name: "PPTX to PDF", description: "Convert a PowerPoint to PDF.", href: "/pptx-to-pdf", icon: Presentation, status: "coming-soon", category: "Convert" },
  { id: "xlsx-to-pdf", name: "XLSX to PDF", description: "Convert a spreadsheet to PDF.", href: "/xlsx-to-pdf", icon: FileSpreadsheet, status: "coming-soon", category: "Convert" },

  // Edit
  { id: "edit", name: "Edit PDF", description: "Add text, shapes, and annotations.", href: "/edit", icon: Pencil, status: "coming-soon", category: "Edit" },
  { id: "add-text", name: "Add Text", description: "Overlay text anywhere on a page.", href: "/add-text", icon: Type, status: "coming-soon", category: "Edit" },
  { id: "annotate", name: "Annotate", description: "Highlights, notes, and shapes.", href: "/annotate", icon: Pencil, status: "coming-soon", category: "Edit" },

  // Security
  { id: "protect", name: "Protect PDF", description: "Encrypt with a password.", href: "/protect", icon: Lock, status: "coming-soon", category: "Security" },
  { id: "unlock", name: "Unlock PDF", description: "Remove password protection.", href: "/unlock", icon: Unlock, status: "coming-soon", category: "Security" },

  // Page tools
  { id: "rotate", name: "Rotate PDF", description: "Rotate pages by 90° increments.", href: "/rotate", icon: RotateCw, status: "ready", category: "Page tools" },
  { id: "page-numbers", name: "Add Page Numbers", description: "Stamp page numbers on every page.", href: "/page-numbers", icon: Hash, status: "ready", category: "Page tools" },
  { id: "watermark", name: "Watermark", description: "Overlay a text watermark on every page.", href: "/watermark", icon: Stamp, status: "ready", category: "Page tools" },
  { id: "crop", name: "Crop PDF", description: "Trim page margins.", href: "/crop", icon: Crop, status: "coming-soon", category: "Page tools" },

  // OCR
  { id: "ocr", name: "OCR PDF", description: "Extract searchable text from scanned PDFs.", href: "/ocr", icon: Languages, status: "coming-soon", category: "OCR" },

  // Other
  { id: "repair", name: "Repair PDF", description: "Attempt to recover a damaged PDF.", href: "/repair", icon: Wrench, status: "coming-soon", category: "Other" },
  { id: "metadata", name: "PDF Info", description: "View and edit PDF metadata.", href: "/metadata", icon: Eye, status: "ready", category: "Other" },
  { id: "redact", name: "Redact", description: "Permanently whiteout sensitive regions.", href: "/redact", icon: EyeOff, status: "coming-soon", category: "Other" },
];

export const CATEGORIES: Tool["category"][] = [
  "Organize",
  "Compress",
  "Convert",
  "Edit",
  "Security",
  "Page tools",
  "OCR",
  "Other",
];

export function getTool(id: string): Tool | undefined {
  return TOOLS.find((t) => t.id === id);
}
