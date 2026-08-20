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
import { loadUnipFieldPositions } from "@/lib/unip-align";
import { MODALIDADES, type Modalidade, cursosPorModalidade, TOTAL_CURSOS } from "@/lib/diploma-cursos";
import templateP1Url from "@/assets/template-unip-p1-hq.webp";
import templateP2Url from "@/assets/template-unip-p2-hq.jpg";
import { loadTemplateObjectUrl } from "@/lib/template-cache";
import { maskDate, maskDigits } from "@/lib/masks";
import { invokeGeneratePdf } from "@/lib/browser-pdf";
import { storePreviewPayload } from "@/lib/preview-payload";
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

const PREFIXO_CURSO: Record<Modalidade, string> = {
  bacharelado: "Curso de",
  licenciatura: "Curso de Licenciatura em",
  tecnologo: "Curso Superior de Tecnologia em",
  tecnico: "Curso Técnico em",
};

const TITULO_CURSO: Record<Modalidade, string> = {
  bacharelado: "Bacharel em",
  licenciatura: "Licenciado em",
  tecnologo: "Tecnólogo em",
  tecnico: "Técnico em",
};

interface UnipForm {
  instituicaoModo: "auto" | "manual";
  instituicaoManual: string;
  modalidade: Modalidade;

  curso: string;
  cursoEmec: string;
  dataConclusao: string;
  dataColacao: string;
  aluno: string;
  sexo: string;
  naturalidade: string;
  nascimento: string;
  identidade: string;
  orgaoExpedidor: string;
  dataExpedicao: string;
  cidadeCampus: string;
  ufCampus: string;
  ra: string;
  lote: string;
  registroNumero: string;
  registroLivro: string;
  registroFolha: string;
  registroData: string;
  processo: string;
}

const initial: UnipForm = {
  instituicaoModo: "auto",
  instituicaoManual: "",
  modalidade: "tecnologo",

  curso: "GESTÃO FINANCEIRA",
  cursoEmec: "120717",
  dataConclusao: "",
  dataColacao: "",
  aluno: "",
  sexo: "M",
  naturalidade: "São Paulo",
  nascimento: "",
  identidade: "",
  orgaoExpedidor: "SSP/SP",
  dataExpedicao: "",
  cidadeCampus: "São Paulo",
  ufCampus: "SP",
  ra: "",
  lote: "",
  registroNumero: "",
  registroLivro: "22/2",
  registroFolha: "",
  registroData: "",
  processo: "",
};

/** Textos institucionais fixos — mesmos em todos os diplomas UNIP, não editáveis pelo usuário. */
const UNIP_RECONHECIMENTO =
  "Reconhecimento Renovado pela Portaria MEC nº 952 de 30/08/2021, publicada\nno DOU nº 165, Seção 1, pág. 72-74 de 31/08/2021.";
const UNIP_RECREDENCIAMENTO =
  "Recredenciada pela Portaria MEC nº 188 de 03.02.2017 publicada no DOU nº 26\nem 06.02.2017, Seção 1, página 17 a 22.";

const NOMES = [
  "Rogério Yoiti Hiramuki", "Ana Carolina Ferreira Lima", "Bruno Henrique Santos Costa",
  "Marina Duarte Albuquerque", "Vitor Emanuel Rocha Prado", "Luciana Almeida Nogueira",
];


const ROUTE_KEY = "/dashboard/documents/diploma-unip";

