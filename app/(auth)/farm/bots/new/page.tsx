import { BotForm } from "@/components/modules/bots/bot-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewBotPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Novo Bot" />
      <BotForm />
    </div>
  );
}
