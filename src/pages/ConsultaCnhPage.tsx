import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Loader2, User, CreditCard, Calendar, MapPin, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function formatCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

interface CnhRecord {
  nome_completo: string;
  cpf: string;
  rg: string;
  registro: string;
  categoria: string;
  data_nascimento: string;
  data_emissao: string;
  data_validade: string;
  renach: string;
  numero_espelho: string;
  cidade_estado: string;
  estado_extenso: string;
  parte1?: string;
  parte2?: string;
  parte3?: string;
  parte4?: string;
}

async function searchCnh(cpfInput: string): Promise<CnhRecord | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Não autenticado");

  const { data: functionData, error } = await supabase.functions.invoke("consulta-cnh", {
    body: { cpf: cpfInput },
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // A chave de leitura da base externa vive no backend secundário; se o
  // principal ainda não tiver essa função publicada, consultamos por lá.
  if (error || !functionData) {
    const bridged = await invokeSecondaryFunction("consulta-cnh", { cpf: cpfInput });
    const payload = bridged?.data as { found?: boolean; data?: CnhRecord } | undefined;
    if (!payload) throw error ?? new Error("Consulta indisponível");
    return payload.found ? (payload.data as CnhRecord) : null;
  }

  if (!functionData?.found) return null;
  return functionData.data as CnhRecord;
}

export default function ConsultaCnhPage() {
  const [cpfInput, setCpfInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CnhRecord | null>(null);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpfInput(formatCpf(e.target.value));
  };

  const handleSearch = async () => {
    const digits = onlyDigits(cpfInput);
    if (digits.length !== 11) {
      toast({ title: "CPF inválido", description: "Digite um CPF com 11 dígitos.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResult(null);
    setSearched(false);

    try {
      const record = await searchCnh(cpfInput);
      setResult(record);
      setSearched(true);
      if (!record) {
        toast({ title: "CPF não encontrado", description: "Nenhuma CNH encontrada para este CPF.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro na consulta", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground break-all">{value || "—"}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <h1 className="font-display text-2xl font-bold text-foreground mb-1">Consulta CNH</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Digite o CPF para buscar a CNH Digital associada.
      </p>

      <div className="flex gap-2 mb-6">
        <Input
          placeholder="000.000.000-00"
          value={cpfInput}
          onChange={handleCpfChange}
          maxLength={14}
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading} variant="gradient" className="shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {searched && result && (
        <Card className="glass p-5 space-y-1">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Resultado da Consulta</p>
          <InfoRow icon={User} label="Nome Completo" value={result.nome_completo} />
          <InfoRow icon={CreditCard} label="CPF" value={result.cpf} />
          <InfoRow icon={ShieldCheck} label="RG" value={result.rg} />
          <InfoRow icon={ShieldCheck} label="Registro" value={result.registro} />
          <InfoRow icon={ShieldCheck} label="Categoria" value={result.categoria} />
          <InfoRow icon={Calendar} label="Nascimento" value={result.data_nascimento} />
          <InfoRow icon={Calendar} label="Emissão" value={result.data_emissao} />
          <InfoRow icon={Calendar} label="Validade" value={result.data_validade} />
          <InfoRow icon={ShieldCheck} label="RENACH" value={result.renach} />
          <InfoRow icon={ShieldCheck} label="Nº Espelho" value={result.numero_espelho} />
          <InfoRow icon={MapPin} label="Cidade/Estado" value={result.cidade_estado} />
          <InfoRow icon={MapPin} label="Estado" value={result.estado_extenso} />

          {(result.parte1 || result.parte2 || result.parte3 || result.parte4) && (
            <div className="pt-4 space-y-3">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Imagens da CNH</p>
              <div className="grid grid-cols-2 gap-2">
                {[result.parte1, result.parte2, result.parte3, result.parte4].map((src, i) =>
                  src ? (
                    <img key={i} src={src} alt={`Parte ${i + 1}`} className="rounded-lg border border-border w-full" />
                  ) : null
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {searched && !result && (
        <Card className="glass p-6 text-center">
          <p className="text-muted-foreground text-sm">Nenhuma CNH encontrada para este CPF.</p>
        </Card>
      )}
    </div>
  );
}
