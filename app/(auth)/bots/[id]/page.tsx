import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { BotForm } from "@/components/modules/bots/bot-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditBotPage({ params }: Props) {
  const { id } = await params;

  const bot = await prisma.bot.findUnique({ where: { id } });

  if (!bot) {
    notFound();
  }

  const initialData = {
    id: bot.id,
    nick: bot.nick,
    email: bot.email,
    password: decrypt(bot.password),
    proxyIp: bot.proxyIp,
    proxyEol: bot.proxyEol?.toISOString() ?? null,
    status: bot.status,
    notes: bot.notes,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Editar Bot: {bot.nick}</h1>
      <BotForm initialData={initialData} />
    </div>
  );
}
