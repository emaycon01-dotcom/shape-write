import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";

const ESTADOS: Record<string, string> = {
  ac: "Acre", al: "Alagoas", ap: "Amapá", am: "Amazonas",
  ba: "Bahia", ce: "Ceará", df: "Distrito Federal", es: "Espírito Santo",
  go: "Goiás", ma: "Maranhão", mt: "Mato Grosso", ms: "Mato Grosso do Sul",
  mg: "Minas Gerais", pa: "Pará", pb: "Paraíba", pr: "Paraná",
  pe: "Pernambuco", pi: "Piauí", rj: "Rio de Janeiro", rn: "Rio Grande do Norte",
  rs: "Rio Grande do Sul", ro: "Rondônia", rr: "Roraima", sc: "Santa Catarina",
  sp: "São Paulo", se: "Sergipe", to: "Tocantins",
};

export default function CnhFisicaEstadoPage() {
  const { uf } = useParams<{ uf: string }>();
  const nomeEstado = ESTADOS[(uf ?? "").toLowerCase()] ?? uf?.toUpperCase();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <MapPin className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">CNH Física — {nomeEstado}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Serviço de CNH física para o estado de {nomeEstado}.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            Informações do Serviço
            <Badge variant="secondary">{uf?.toUpperCase()}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Preencha os dados necessários para solicitar a CNH física do estado de {nomeEstado}.
          </p>
          <p className="text-sm text-muted-foreground italic">
            Funcionalidade em construção. Em breve você poderá realizar pedidos aqui.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
