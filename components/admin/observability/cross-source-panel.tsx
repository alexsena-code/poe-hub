import { SourceBadge } from "./analytics-shared";

interface CrossSourceItem {
  keyword: string;
  sources: string[];
}

export function CrossSourcePanel({
  items,
  loading,
}: {
  items: CrossSourceItem[];
  loading: boolean;
}) {
  return (
    <section className="bg-surface border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Cross-Source Keywords</h2>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No keywords found in multiple sources yet. Run scans across YouTube, Reddit, and GSC.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="pb-2 pr-4">Keyword</th>
                <th className="pb-2">Sources</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.keyword}
                  className="border-b border-border/50 hover:bg-surface-hover"
                >
                  <td className="py-2 pr-4 text-foreground">{item.keyword}</td>
                  <td className="py-2">
                    <div className="flex gap-1.5">
                      {item.sources.map((src) => (
                        <SourceBadge key={src} source={src} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
