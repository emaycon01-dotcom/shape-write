import { useState } from "react";
import MedicamentoSearch from "@/components/MedicamentoSearch";
import { Button } from "@/components/ui/button";

export default function MedTestPage() {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<string>("");
  return (
    <div className="p-6">
      <Button onClick={() => setOpen(true)}>Pesquisar medicamento na base</Button>
      <pre className="mt-4 text-xs text-foreground">{last}</pre>
      <MedicamentoSearch open={open} onOpenChange={setOpen} onSelect={(m) => setLast(JSON.stringify(m, null, 2))} />
    </div>
  );
}
