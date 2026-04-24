import { PageHeader } from "@/components/ui/page-header";

export default function SeoAnalysisPage() {
  // B4 placeholder — será o split de research/analysis/opportunities do
  // antigo /seo/page.tsx. Por ora só avisa que tá planejado.
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <PageHeader
        title="SEO Analysis"
        description="Planejado para session 02 fase B4 — SerpAnalysis por keyword, ContentScorer, gap reports. Use /seo/research enquanto isso."
        accent="var(--color-seo)"
      />
    </div>
  );
}
