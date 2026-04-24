import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, Flag, Globe, Trophy, Users } from "lucide-react";

const settingsCards = [
  {
    title: "Feature Flags (Engine)",
    description:
      "Liga/desliga o outline proposer, plan node, gap check e outros flags do content engine em runtime",
    href: "/admin/config/feature-flags",
    icon: Flag,
  },
  {
    title: "Configuracoes de Custo",
    description: "Gerencie perfis de custo operacional para simulacoes",
    href: "/admin/config/costs",
    icon: DollarSign,
  },
  {
    title: "Proxy Global",
    description: "Configuracao de proxy compartilhada entre os bots",
    href: "/admin/config/proxy",
    icon: Globe,
  },
  {
    title: "Gerenciar Ligas",
    description: "Adicionar, editar e ativar ligas de PoE",
    href: "/admin/config/leagues",
    icon: Trophy,
  },
  {
    title: "Gerenciar Usuarios",
    description: "Criar e gerenciar contas de usuario",
    href: "/admin/config/users",
    icon: Users,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuracoes</h1>
        <p className="text-muted-foreground">
          Gerencie as configuracoes do sistema.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {settingsCards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card className="transition-colors hover:bg-muted/50 cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{card.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
