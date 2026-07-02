import { FillForm } from "@/components/modules/fills/fill-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewFillPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Nova Order" />
      <FillForm />
    </div>
  );
}
