import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";

const docTypes = [
  { id: "cnh", name: "CNH Digital (2024)", description: "CNH Digital com login, APK e QR Code", credits: 1 },
  { id: "rg", name: "CIN (RG Digital)", description: "Carteira de Identidade Nacional", credits: 1 },
  { id: "certificado", name: "Certificado", description: "Certificado digital personalizado", credits: 1 },
];

export default function DocumentsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", identification: "", date: "", description: "", additionalInfo: "" });
  const { user } = useAuth();
  const { addDocument } = useDocuments();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !user) return;
    const doc = addDocument({ ...formData, type: selected, userId: user.id });
    navigate(`/dashboard/history`);
  };

  if (!selected) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground mb-1">Módulos de Documentos</h1>
        <p className="text-muted-foreground mb-8">Escolha um serviço para começar</p>

        <p className="text-xs text-muted-foreground tracking-widest mb-4">DOCUMENTOS DIGITAIS</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docTypes.map((dt) => (
            <button
              key={dt.id}
              onClick={() => setSelected(dt.id)}
              className="glass rounded-xl p-6 text-left hover:border-primary/40 transition-colors group"
            >
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground mb-1">{dt.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">{dt.description}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-success font-medium">{dt.credits} Crédito</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success">ATIVO</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground mb-4 block">
        ← Voltar
      </button>
      <h1 className="font-display text-3xl font-bold text-foreground mb-1">Gerar Documento</h1>
      <p className="text-muted-foreground mb-8">Preencha os dados do documento</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label>Nome Completo</Label>
          <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-secondary border-border" required />
        </div>
        <div className="space-y-2">
          <Label>Identificação</Label>
          <Input value={formData.identification} onChange={(e) => setFormData({ ...formData, identification: e.target.value })} className="bg-secondary border-border" required />
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="bg-secondary border-border" required />
        </div>
        <div className="space-y-2">
          <Label>Descrição</Label>
          <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="bg-secondary border-border" />
        </div>
        <div className="space-y-2">
          <Label>Informações Adicionais</Label>
          <Textarea value={formData.additionalInfo} onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })} className="bg-secondary border-border" />
        </div>

        <Button type="submit" variant="gradient" className="w-full h-12 text-base rounded-lg">
          <QrCode className="w-5 h-5 mr-2" /> Gerar Documento
        </Button>
      </form>
    </div>
  );
}
