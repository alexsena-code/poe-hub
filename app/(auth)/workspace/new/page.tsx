import { Suspense } from "react";
import BriefingForm from "@/components/engine/BriefingForm";

export default function NewPostPage() {
  return (
    <div className="flex flex-col flex-1 items-center py-12 px-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-accent mb-2">Novo Post</h1>
        <p className="text-muted-foreground mb-8">
          Preencha o briefing para gerar o outline do conteudo.
        </p>
        <Suspense fallback={<div>Loading...</div>}>
          <BriefingForm />
        </Suspense>
      </div>
    </div>
  );
}
