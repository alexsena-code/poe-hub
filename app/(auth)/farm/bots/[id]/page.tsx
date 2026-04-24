import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { BotForm } from "@/components/modules/bots/bot-form";
import { PageHeader } from "@/components/ui/page-header";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditBotPage({ params }: Props) {
  const { id } = await params;
  const headersList = await headers();
  const cookie = headersList.get("cookie") ?? "";

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3002"}/api/bots/${id}?reveal=true`,
    { headers: { cookie }, cache: "no-store" }
  );

  if (res.status === 404) notFound();
  if (!res.ok) throw new Error("Failed to fetch bot");

  const bot = await res.json();

  const initialData = {
    id: bot.id,
    nick: bot.nick,
    email: bot.email,
    password: bot.password,
    proxyIp: bot.proxyIp,
    proxyEol: bot.proxyEol ?? null,
    status: bot.status,
    notes: bot.notes,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={`Editar Bot: ${bot.nick}`} />
      <BotForm initialData={initialData} />
    </div>
  );
}
