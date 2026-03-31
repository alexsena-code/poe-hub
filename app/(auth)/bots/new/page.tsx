import { BotForm } from "@/components/modules/bots/bot-form";

export default function NewBotPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Novo Bot</h1>
      <BotForm />
    </div>
  );
}
