import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import FormDraftsPanel from "@/components/FormDraftsPanel";
import CidadeUfPicker from "@/components/CidadeUfPicker";
import { saveFormDraft } from "@/lib/form-drafts";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useDocuments } from "@/contexts/DocumentContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  GraduationCap, University, Loader2, FlaskConical, Trash2, User, FileSignature, Check, ChevronsUpDown,
  ArrowLeft, Sparkles, ShieldCheck, Eye, CreditCard, FileText, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadAnhangueraFieldPositions } from "@/lib/anhanguera-align";
import { MODALIDADES, type Modalidade, cursosPorModalidade, TOTAL_CURSOS } from "@/lib/diploma-cursos";
import templateP1Url from "@/assets/template-anhanguera-p1-hq.jpg";
import templateP2Url from "@/assets/template-anhanguera-p2-hq.jpg";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskDigits } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { pick, rnd } from "@/lib/random";
import { PdfCanvasPreview } from "@/components/PdfCanvasPreview";
import PdfReadyDialog from "@/components/PdfReadyDialog";
import { planCost, formatCredits } from "@/lib/plan-pricing";
import { creditRef } from "@/lib/credit-ref";
import { describeError } from "@/lib/describe-error";
import { saveFinalPdf, readFinalPdf } from "@/lib/preview-payload";

const ESTADOS = [
  "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo",
  "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba",
  "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul",
  "Rondônia", "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins",
];

import { titleCase, dataExtenso } from "@/lib/text";

/** Título conferido com flexão de gênero conforme a modalidade do curso. */
const TITULO_CURSO: Record<Modalidade, (curso: string, fem: boolean) => string> = {
  bacharelado: (c, f) => `${f ? "Bacharela" : "Bacharel"} em ${c}`,
  licenciatura: (c, f) => `${f ? "Licenciada" : "Licenciado"} em ${c}`,
  tecnologo: (c, f) => `${f ? "Tecnóloga" : "Tecnólogo"} em ${c}`,
  tecnico: (c, f) => `${f ? "Técnica" : "Técnico"} em ${c}`,
};

interface AnhangueraForm {
  unidade: string;
  modalidade: Modalidade;
  curso: string;
  tituloManual: string;
  dataConclusao: string;
  dataColacao: string;
  aluno: string;
  sexo: string;
  naturalidade: string;
  nascimento: string;
  identidade: string;
  orgaoExpedidor: string;
  cidadeDiploma: string;
  ufDiploma: string;
  dataDiploma: string;
  registroNumero: string;
  registroLivro: string;
  processo: string;
  cidadeRegistro: string;
  ufRegistro: string;
  dataRegistro: string;
}

const initial: AnhangueraForm = {
  unidade: "Faculdade Anhanguera de Macapá",
  modalidade: "bacharelado",
  curso: "ENFERMAGEM",
  tituloManual: "",
  dataConclusao: "",
  dataColacao: "",
  aluno: "",
  sexo: "F",
  naturalidade: "Amapá",
  nascimento: "",
  identidade: "",
  orgaoExpedidor: "PTC/AP",
  cidadeDiploma: "Macapá",
  ufDiploma: "AP",
  dataDiploma: "",
  registroNumero: "",
  registroLivro: "25",
  processo: "",
  cidadeRegistro: "Campo Grande",
  ufRegistro: "MS",
  dataRegistro: "",
};

/** Textos institucionais fixos — mesmos em todos os diplomas Anhanguera, não editáveis pelo usuário. */
const ANHANGUERA_RECONHECIMENTO =
  "Renovação de Reconhecimento pela Portaria Ministerial nº 1899 de 07/12/2021 - publicada no D.O.U 234 , seção 1, pág. 57 de 14/12/2021.";
const ANHANGUERA_RECREDENCIAMENTO_IES =
  "Recredenciada pela Portaria Ministerial nº 336 de 08/02/2019 - publicada no D.O.U 29 , seção 1, pág. 40 de 11/02/2019.";
const ANHANGUERA_RECREDENCIAMENTO_UNIVERSIDADE =
  "Recredenciada pelo Decreto nº 123 de 18/12/1996 - publicada no D.O.U 246, seção 1, pág. 27624 de 19/12/1996.";

const NOMES = [
  "Jennifer Liziêr Farias Dias", "Ana Carolina Ferreira Lima", "Bruno Henrique Santos Costa",
  "Marina Duarte Albuquerque", "Vitor Emanuel Rocha Prado", "Luciana Almeida Nogueira",
];


const ROUTE_KEY = "/dashboard/documents/diploma-anhanguera";

