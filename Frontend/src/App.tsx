import { Route, Routes } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { HomePage } from "@/pages/HomePage";
import { MergePage } from "@/pages/MergePage";
import { SplitPage } from "@/pages/SplitPage";
import { CompressPage } from "@/pages/CompressPage";
import { RotatePage } from "@/pages/RotatePage";
import { OrganizePage } from "@/pages/OrganizePage";
import { WatermarkPage } from "@/pages/WatermarkPage";
import { PageNumbersPage } from "@/pages/PageNumbersPage";
import { MetadataPage } from "@/pages/MetadataPage";
import { PricingPage } from "@/pages/PricingPage";
import { AuthPage } from "@/pages/AuthPage";
import { ComingSoonPage } from "@/pages/ComingSoonPage";
import { getTool } from "@/lib/tools";

function ToolOrComingSoon({ toolId }: { toolId: string }) {
  const tool = getTool(toolId);
  return <ComingSoonPage tool={tool?.name ?? toolId} />;
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/merge" element={<MergePage />} />
          <Route path="/split" element={<SplitPage />} />
          <Route path="/compress" element={<CompressPage />} />
          <Route path="/rotate" element={<RotatePage />} />
          <Route path="/organize" element={<OrganizePage />} />
          <Route path="/watermark" element={<WatermarkPage />} />
          <Route path="/page-numbers" element={<PageNumbersPage />} />
          <Route path="/metadata" element={<MetadataPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />

          {/* Phase 2-6 tools — same "Coming Soon" surface until they're built. */}
          {[
            "delete-pages",
            "extract-pages",
            "pdf-to-jpg",
            "jpg-to-pdf",
            "pdf-to-text",
            "pdf-to-docx",
            "docx-to-pdf",
            "pptx-to-pdf",
            "xlsx-to-pdf",
            "edit",
            "add-text",
            "annotate",
            "protect",
            "unlock",
            "crop",
            "ocr",
            "repair",
            "redact",
          ].map((id) => (
            <Route
              key={id}
              path={`/${id}`}
              element={<ToolOrComingSoon toolId={id} />}
            />
          ))}

          <Route path="*" element={<ComingSoonPage tool="Page" />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
