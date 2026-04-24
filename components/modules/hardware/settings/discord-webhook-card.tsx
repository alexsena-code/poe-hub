"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bell, Send } from "lucide-react";

interface DiscordWebhookCardProps {
  webhookUrl: string;
  setWebhookUrl: (v: string) => void;
  webhookConfigured: boolean;
  webhookTesting: boolean;
  onSave: () => Promise<void>;
  onTest: () => Promise<void>;
}

export function DiscordWebhookCard({
  webhookUrl,
  setWebhookUrl,
  webhookConfigured,
  webhookTesting,
  onSave,
  onTest,
}: DiscordWebhookCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5" /> Discord Alerts
        </CardTitle>
        <CardDescription>
          Receba notificações quando um deal abaixo do preço máximo for encontrado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge
            variant={webhookConfigured ? "default" : "secondary"}
            className={webhookConfigured ? "bg-green-600" : ""}
          >
            {webhookConfigured ? "Configurado" : "Não configurado"}
          </Badge>
          {webhookConfigured && (
            <Button size="sm" variant="outline" disabled={webhookTesting} onClick={onTest}>
              <Send className={`h-4 w-4 mr-1 ${webhookTesting ? "animate-pulse" : ""}`} />
              Testar
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {/* type="password" prevents browser from autofilling the webhook URL as a credential */}
          <Input
            placeholder="https://discord.com/api/webhooks/..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="flex-1"
            type="password"
          />
          <Button size="sm" disabled={!webhookUrl.trim()} onClick={onSave}>
            Salvar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Crie um webhook no Discord: Configurações do Canal → Integrações → Webhooks → Novo Webhook
        </p>
      </CardContent>
    </Card>
  );
}
