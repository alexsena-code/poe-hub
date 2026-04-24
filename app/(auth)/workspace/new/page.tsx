import { Suspense } from "react";
import BriefingForm from "@/components/engine/BriefingForm";
import { PageHeader } from "@/components/ui/page-header";

export default function NewPostPage() {
  return (
    <div className="flex flex-col flex-1 items-center py-12 px-4">
      <div className="w-full max-w-2xl">
        <PageHeader
          title="Novo Post"
          description="Preencha o briefing para gerar o outline do conteudo."
          className="mb-8"
        />
        <Suspense fallback={<div>Loading...</div>}>
          <BriefingForm />
        </Suspense>
      </div>
    </div>
  );
}
