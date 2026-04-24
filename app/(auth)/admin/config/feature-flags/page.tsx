import FeatureFlagsPanel from "@/components/engine/FeatureFlagsPanel";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = {
  title: "Feature Flags — Engine",
};

export default function FeatureFlagsSettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Feature Flags — Content Engine"
        description="Toggles runtime do pipeline de geração. Overrides ficam em output/feature-flags.json e vencem as variáveis de ambiente. Nenhum restart necessário."
      />
      <FeatureFlagsPanel />
    </div>
  );
}
