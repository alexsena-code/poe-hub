import { ConfigNav } from "./config-nav";

export default function AdminConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuracoes</h1>
        <p className="text-sm text-muted-foreground">
          Engine, custos, ligas, usuarios, proxy e feature flags em um
          so lugar.
        </p>
      </div>

      <ConfigNav />

      <div>{children}</div>
    </div>
  );
}
