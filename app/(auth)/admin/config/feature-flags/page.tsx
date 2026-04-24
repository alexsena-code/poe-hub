import FeatureFlagsPanel from "@/components/engine/FeatureFlagsPanel";

export const metadata = {
  title: "Feature Flags — Engine",
};

export default function FeatureFlagsSettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Feature Flags — Content Engine</h1>
        <p className="text-muted-foreground mt-1">
          Toggles runtime do pipeline de geração. Overrides ficam em{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">
            output/feature-flags.json
          </code>{" "}
          e vencem as variáveis de ambiente. Nenhum restart necessário.
        </p>
      </div>
      <FeatureFlagsPanel />
    </div>
  );
}
