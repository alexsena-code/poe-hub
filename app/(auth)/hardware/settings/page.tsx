"use client";

import { PageHeader } from "@/components/ui/page-header";
import { useSettingsState } from "@/components/modules/hardware/settings/use-settings-state";
import { WorkerStatusCard } from "@/components/modules/hardware/settings/worker-status-card";
import { CategoriesCard } from "@/components/modules/hardware/settings/categories-card";
import { DiscordWebhookCard } from "@/components/modules/hardware/settings/discord-webhook-card";
import { ProxyPoolCard } from "@/components/modules/hardware/settings/proxy-pool-card";

export default function HardwareSettingsPage() {
  const s = useSettingsState();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Settings"
        description="Manage scraper configuration, OLX categories, and proxies."
      />

      <WorkerStatusCard status={s.workerStatus} loading={s.workerLoading} />

      <CategoriesCard
        categories={s.categories}
        loading={s.categoriesLoading}
        newCatPath={s.newCatPath}
        setNewCatPath={s.setNewCatPath}
        newCatLabel={s.newCatLabel}
        setNewCatLabel={s.setNewCatLabel}
        newCatAllowed={s.newCatAllowed}
        setNewCatAllowed={s.setNewCatAllowed}
        onAdd={s.addCategory}
        onUpdateAllowed={s.updateCategoryAllowed}
        onToggle={s.toggleCategory}
        onDelete={s.deleteCategory}
      />

      <DiscordWebhookCard
        webhookUrl={s.webhookUrl}
        setWebhookUrl={s.setWebhookUrl}
        webhookConfigured={s.webhookConfigured}
        webhookTesting={s.webhookTesting}
        onSave={s.saveWebhook}
        onTest={s.testWebhook}
      />

      <ProxyPoolCard
        proxies={s.proxies}
        loading={s.proxiesLoading}
        newProxyUrl={s.newProxyUrl}
        setNewProxyUrl={s.setNewProxyUrl}
        testingProxies={s.testingProxies}
        onAdd={s.addProxy}
        onDelete={s.deleteProxy}
        onReset={s.resetProxy}
        onTestAll={s.testAllProxies}
      />
    </div>
  );
}
