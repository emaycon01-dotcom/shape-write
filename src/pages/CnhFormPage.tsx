import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Upload, X } from "lucide-react";

interface CnhFormData {
  nomeCompleto: string;
  cpf: string;
  rg: string;
  dataNascimento: string;
  genero: string;
  nacionalidade: string;
  cidadeEstado: string;
  estadoExtenso: string;
  registro: string;
  categoria: string;
  dataPrimeiraHab: string;
  dataEmissao: string;
  dataValidade: string;
  renach: string;
  codigoSeguranca: string;
  numeroEspelho: string;
  nomePai: string;
  nomeMae: string;
}

const initialFormData: CnhFormData = {
  nomeCompleto: "",
  cpf: "",
  rg: "",
  dataNascimento: "",
  genero: "",
  nacionalidade: "BRASILEIRA",
  cidadeEstado: "",
  estadoExtenso: "",
  registro: "",
  categoria: "",
  dataPrimeiraHab: "",
  dataEmissao: "",
  dataValidade: "",
  renach: "",
  codigoSeguranca: "",
  numeroEspelho: "",
  nomePai: "",
  nomeMae: "",
};

export default function CnhFormPage() {
  const [formData, setFormData] = useState<CnhFormData>(initialFormData);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [assinatura, setAssinatura] = useState<File | null>(null);
  const [assinaturaPreview, setAssinaturaPreview] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const assRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { addDocument } = useDocuments();
  const navigate = useNavigate();

  const set = (field: keyof CnhFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (s: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearFile = (
    setFile: (f: File | null) => void,
    setPreview: (s: string | null) => void,
    ref: React.RefObject<HTMLInputElement>
  ) => {
    setFile(null);
    setPreview(null);
    if (ref.current) ref.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    addDocument({
      name: formData.nomeCompleto,
      identification: formData.cpf,
      date: formData.dataEmissao,
      description: `CNH - Cat ${formData.categoria}`,
      additionalInfo: JSON.stringify(formData),
      type: "cnh",
      userId: user.id,
    });
    navigate("/dashboard/history");
  };

  const inputClass = "bg-secondary border-border";
  const sectionTitle = "text-xs font-semibold tracking-widest text-primary uppercase mb-4 mt-2";

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate("/dashboard/documents")} className="text-sm text-muted-foreground hover:text-foreground mb-4 block">
        ← Voltar
      </button>
      <h1 className="font-display text-3xl font-bold text-foreground mb-1">CNH Digital (2024)</h1>
      <p className="text-muted-foreground mb-8">Preencha todos os campos para gerar o documento</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SEÇÃO 1 */}
        <div className="glass rounded-xl p-6 space-y-4">
          <p className={sectionTitle}>Dados Pessoais</p>
          <div className="space-y-2">
            <Label>Nome Completo</Label>
            <Input value={formData.nomeCompleto} onChange={set("nomeCompleto")} className={inputClass} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={formData.cpf} onChange={set("cpf")} placeholder="000.000.000-00" className={inputClass} required />
            </div>
            <div className="space-y-2">
              <Label>RG</Label>
              <Input value={formData.rg} onChange={set("rg")} className={inputClass} required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Input type="date" value={formData.dataNascimento} onChange={set("dataNascimento")} className={inputClass} required />
            </div>
            <div className="space-y-2">
              <Label>Gênero</Label>
              <Select value={formData.genero} onValueChange={(v) => setFormData((p) => ({ ...p, genero: v }))}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nacionalidade</Label>
              <Input value={formData.nacionalidade} onChange={set("nacionalidade")} className={inputClass} required />
            </div>
            <div className="space-y-2">
              <Label>Cidade / Estado</Label>
              <Input value={formData.cidadeEstado} onChange={set("cidadeEstado")} placeholder="São Paulo / SP" className={inputClass} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Estado por Extenso</Label>
            <Input value={formData.estadoExtenso} onChange={set("estadoExtenso")} placeholder="São Paulo" className={inputClass} required />
          </div>
        </div>

        {/* SEÇÃO 2 */}
        <div className="glass rounded-xl p-6 space-y-4">
          <p className={sectionTitle}>Dados da Habilitação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Registro</Label>
              <Input value={formData.registro} onChange={set("registro")} className={inputClass} required />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input value={formData.categoria} onChange={set("categoria")} placeholder="AB" className={inputClass} required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data 1ª Habilitação</Label>
              <Input type="date" value={formData.dataPrimeiraHab} onChange={set("dataPrimeiraHab")} className={inputClass} required />
            </div>
            <div className="space-y-2">
              <Label>Data de Emissão</Label>
              <Input type="date" value={formData.dataEmissao} onChange={set("dataEmissao")} className={inputClass} required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Validade</Label>
              <Input type="date" value={formData.dataValidade} onChange={set("dataValidade")} className={inputClass} required />
            </div>
            <div className="space-y-2">
              <Label>RENACH</Label>
              <Input value={formData.renach} onChange={set("renach")} className={inputClass} required />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código de Segurança</Label>
              <Input value={formData.codigoSeguranca} onChange={set("codigoSeguranca")} className={inputClass} required />
            </div>
            <div className="space-y-2">
              <Label>Número do Espelho</Label>
              <Input value={formData.numeroEspelho} onChange={set("numeroEspelho")} className={inputClass} required />
            </div>
          </div>
        </div>

        {/* SEÇÃO 3 */}
        <div className="glass rounded-xl p-6 space-y-4">
          <p className={sectionTitle}>Filiação</p>
          <div className="space-y-2">
            <Label>Nome do Pai</Label>
            <Input value={formData.nomePai} onChange={set("nomePai")} className={inputClass} required />
          </div>
          <div className="space-y-2">
            <Label>Nome da Mãe</Label>
            <Input value={formData.nomeMae} onChange={set("nomeMae")} className={inputClass} required />
          </div>
        </div>

        {/* SEÇÃO 4 */}
        <div className="glass rounded-xl p-6 space-y-4">
          <p className={sectionTitle}>Upload de Arquivos</p>

          {/* Foto 3x4 */}
          <div className="space-y-2">
            <Label>Foto 3x4</Label>
            {fotoPreview ? (
              <div className="relative w-32 h-40 rounded-lg overflow-hidden border border-border">
                <img src={fotoPreview} alt="Foto" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => clearFile(setFoto, setFotoPreview, fotoRef)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-destructive-foreground" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fotoRef.current?.click()}
                className="w-full h-28 rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Upload className="w-5 h-5" />
                <span className="text-sm">Clique para enviar a foto</span>
              </button>
            )}
            <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, setFoto, setFotoPreview)} />
          </div>

          {/* Assinatura */}
          <div className="space-y-2">
            <Label>Assinatura Digital</Label>
            {assinaturaPreview ? (
              <div className="relative w-56 h-20 rounded-lg overflow-hidden border border-border bg-secondary">
                <img src={assinaturaPreview} alt="Assinatura" className="w-full h-full object-contain" />
                <button
                  type="button"
                  onClick={() => clearFile(setAssinatura, setAssinaturaPreview, assRef)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-destructive-foreground" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => assRef.current?.click()}
                className="w-full h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <Upload className="w-5 h-5" />
                <span className="text-sm">Clique para enviar a assinatura</span>
              </button>
            )}
            <input ref={assRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e, setAssinatura, setAssinaturaPreview)} />
          </div>
        </div>

        <Button type="submit" variant="gradient" className="w-full h-14 text-base rounded-xl font-semibold">
          <Eye className="w-5 h-5 mr-2" /> GERAR PREVIEW DO DOCUMENTO
        </Button>
      </form>
    </div>
  );
}
