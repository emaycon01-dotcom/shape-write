import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Copy, RotateCcw, Save, Minus, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import templateBgUrl from "@/assets/template-cnh-bg-hq.jpg";
import templateRgBgUrl from "@/assets/template-rg-bg-hq.jpg";
import templateAtestadoBgUrl from "@/assets/template-atestado-bg-hq.jpg";
import templateCrlvBgUrl from "@/assets/template-crlv-bg-hq.jpg";
import templateChaBgUrl from "@/assets/template-cha-bg-hq.jpg";
import templateDiplomaP1Url from "@/assets/template-diploma-p1-hq.jpg";
import templateDiplomaP2Url from "@/assets/template-diploma-p2-hq.jpg";
import { CNH_ALIGN_STORAGE_KEY, loadCnhFieldPositions } from "@/lib/cnh-align";
import { RG_ALIGN_STORAGE_KEY, loadRgFieldPositions } from "@/lib/rg-align";
import { ATESTADO_ALIGN_STORAGE_KEY, loadAtestadoFieldPositions } from "@/lib/atestado-align";
import { CRLV_ALIGN_STORAGE_KEY, loadCrlvFieldPositions } from "@/lib/crlv-align";
import { CHA_ALIGN_STORAGE_KEY, loadChaFieldPositions } from "@/lib/cha-align";
import { DIPLOMA_ALIGN_STORAGE_KEY, loadDiplomaFieldPositions } from "@/lib/diploma-align";
import { HAPVIDA_ALIGN_STORAGE_KEY, loadHapvidaFieldPositions } from "@/lib/hapvida-align";
import { UNIMED_ALIGN_STORAGE_KEY, loadUnimedFieldPositions } from "@/lib/unimed-align";
import { HISTORICO_ALIGN_STORAGE_KEY, loadHistoricoFieldPositions } from "@/lib/historico-align";
import { CERTIDAO_ALIGN_STORAGE_KEY, loadCertidaoFieldPositions } from "@/lib/certidao-align";
import { DECLARACAO_ALIGN_STORAGE_KEY, loadDeclaracaoFieldPositions } from "@/lib/declaracao-align";
import { RECEITA_ALIGN_STORAGE_KEY, loadReceitaFieldPositions } from "@/lib/receita-align";
import { CRAF_ALIGN_STORAGE_KEY, loadCrafFieldPositions } from "@/lib/craf-align";
import templateHapvidaBgUrl from "@/assets/template-hapvida-bg-hq.jpg";
import templateUnimedBgUrl from "@/assets/template-unimed-bg-hq.jpg";
import templateHistoricoBgUrl from "@/assets/template-historico-bg-hq.jpg";
import templateCertidaoBgUrl from "@/assets/template-certidao-bg-hq.jpg";
import templateDeclaracaoBgUrl from "@/assets/template-declaracao-bg-hq.jpg";
import templateReceitaBgUrl from "@/assets/template-receita-bg-hq.jpg";
import templateCrafBgUrl from "@/assets/template-craf-bg-hq.jpg";
import { UNIP_ALIGN_STORAGE_KEY, loadUnipFieldPositions } from "@/lib/unip-align";
import { ANHANGUERA_ALIGN_STORAGE_KEY, loadAnhangueraFieldPositions } from "@/lib/anhanguera-align";
import templateUnipP1Url from "@/assets/template-unip-p1-hq.jpg";
import templateUnipP2Url from "@/assets/template-unip-p2-hq.jpg";
import templateAnhangueraP1Url from "@/assets/template-anhanguera-p1-hq.jpg";
import templateAnhangueraP2Url from "@/assets/template-anhanguera-p2-hq.jpg";
import { saveAlignmentToDb, syncAlignmentsFromDb } from "@/lib/align-sync";

const PAGE_W = 794;
const PAGE_H = 1123;

const CNH_FONT = "'CNHDigital', Arial, Helvetica, sans-serif";
const RG_FONT = "'RGDigital', Arial, Helvetica, sans-serif";
const RG_MRZ_FONT = "'RGOcrb', 'Courier New', monospace";
const ATESTADO_FONT = "Calibri, Carlito, 'Segoe UI', Arial, Helvetica, sans-serif";
const HAPVIDA_FONT = "Arial, 'Liberation Sans', Helvetica, sans-serif";
const CRLV_FONT = "'FreeMono', 'Liberation Mono', 'Courier New', monospace";
const CHA_FONT = "Arial, 'Liberation Sans', Helvetica, sans-serif";
const UNIMED_FONT = "Verdana, 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif";
const DIPLOMA_FONT = "Arial, 'Liberation Sans', Helvetica, sans-serif";
const CERTIDAO_FONT = "Arial, 'Liberation Sans', Helvetica, sans-serif";
const DECLARACAO_FONT = "Arial, 'Liberation Sans', Helvetica, sans-serif";
const HISTORICO_FONT = "Arial, 'Liberation Sans', Helvetica, sans-serif";
const RECEITA_FONT = "Arial, 'Liberation Sans', Helvetica, sans-serif";
const CRAF_FONT = "Arial, 'Liberation Sans', Helvetica, sans-serif";
const UNIP_FONT = "Cambria, Georgia, 'Times New Roman', serif";
const ANHANGUERA_FONT = "'Poppins', Helvetica, Arial, sans-serif";



interface FieldDef {
  id: string;
  label: string;
  sampleText: string;
  x: number;
  y: number;
  fontSize: number;
  w?: number;
  h?: number;
  color?: string;
  rotate?: number;
  bold?: boolean;
}

export const defaultCnhFields: FieldDef[] = [
  { id: "photo", label: "Foto", sampleText: "[FOTO]", x: 98, y: 165, fontSize: 8, w: 82, h: 110, color: "#999" },
  { id: "signature", label: "Assinatura", sampleText: "[ASSINATURA]", x: 93, y: 276, fontSize: 7, w: 95, h: 32, color: "#999" },
  { id: "nome", label: "Nome", sampleText: "MARIA OLIVEIRA SANTOS", x: 102, y: 149, fontSize: 6.5 },
  { id: "primeira_hab", label: "1ª Hab", sampleText: "27/09/2017", x: 308, y: 149, fontSize: 6.5 },
  { id: "nascimento", label: "Nascimento", sampleText: "11/03/1989, RIO DE JANEIRO, RJ", x: 191, y: 168, fontSize: 6.5 },
  { id: "emissao", label: "Emissão", sampleText: "14/03/2026", x: 194, y: 187, fontSize: 6.5 },
  { id: "validade", label: "Validade", sampleText: "14/03/2036", x: 251, y: 187, fontSize: 6.5, color: "#c00" },
  { id: "cat_big", label: "Cat. Grande (D/P)", sampleText: "D", x: 338, y: 184, fontSize: 11 },
  { id: "validade_cat_acc", label: "Validade Cat. ACC", sampleText: "14/03/2036", x: 171, y: 341, fontSize: 4.5 },
  { id: "validade_cat_a", label: "Validade Cat. A", sampleText: "14/03/2036", x: 171, y: 353, fontSize: 4.5 },
  { id: "validade_cat_b", label: "Validade Cat. B", sampleText: "14/03/2036", x: 171, y: 375, fontSize: 4.5 },
  { id: "validade_cat_c", label: "Validade Cat. C", sampleText: "14/03/2036", x: 171, y: 397, fontSize: 4.5 },
  { id: "validade_cat_d", label: "Validade Cat. D", sampleText: "14/03/2036", x: 275, y: 342, fontSize: 4.5 },
  { id: "validade_cat_e", label: "Validade Cat. E", sampleText: "14/03/2036", x: 274, y: 375, fontSize: 4.5 },
  { id: "rg", label: "RG", sampleText: "3963221 SSP PR", x: 193, y: 207, fontSize: 6.5 },
  { id: "cpf", label: "CPF", sampleText: "997.038.350-25", x: 192, y: 226, fontSize: 6.5 },
  { id: "registro", label: "Registro", sampleText: "07915888995", x: 258, y: 226, fontSize: 6.5, color: "#c00" },
  { id: "cat_hab", label: "Cat. Hab", sampleText: "AB", x: 320, y: 225, fontSize: 7, color: "#c00" },
  { id: "nacionalidade", label: "Nacionalidade", sampleText: "BRASILEIRA", x: 191, y: 245, fontSize: 6.5 },
  { id: "pai", label: "Pai", sampleText: "JOSE DA SILVA", x: 192, y: 267, fontSize: 6.5 },
  { id: "mae", label: "Mãe", sampleText: "SANDRA COSTA", x: 192, y: 278, fontSize: 6.5 },
  { id: "obs", label: "Observações", sampleText: "EAR; 99; MOPP;", x: 99, y: 430, fontSize: 5.5 },
  { id: "espelho", label: "Nº Espelho", sampleText: "77424319856", x: 283, y: 498, fontSize: 6.5 },
  { id: "renach", label: "RENACH", sampleText: "PB527125303", x: 284, y: 507, fontSize: 6.5 },
  { id: "local", label: "Local", sampleText: "RIO DE JANEIRO, RJ", x: 98, y: 507, fontSize: 6 },
  { id: "estado", label: "Estado", sampleText: "BAHIA", x: 201, y: 534, fontSize: 15 },
  {
    id: "mrz",
    label: "MRZ",
    sampleText: "I<BRA81008622604<002<<<<<<<<<<\n9610286M3604270BRA<<<<<<<<<<1<\nMARIA<<OLIVEIRA<SANTOS<<<<<<<<",
    x: 99,
    y: 706,
    fontSize: 9.5,
  },
  { id: "reg_vert_top", label: "Reg. Vertical (topo)", sampleText: "07915888995", x: 66, y: 302, fontSize: 12, rotate: -90 },
  { id: "reg_vert_bot", label: "Reg. Vertical (base)", sampleText: "07915888995", x: 64, y: 546, fontSize: 11.5, rotate: -90 },
  { id: "qr", label: "QR Code (validação)", sampleText: "[QR]", x: 437, y: 118, fontSize: 8, w: 277, h: 277, color: "#999" },
];

// Defaults MUST match supabase/functions/generate-rg-pdf/index.ts RG_DEFAULT_POSITIONS
export const defaultRgFields: FieldDef[] = [
  // Frente
  { id: "photo", label: "Foto 3x4 (frente)", sampleText: "[FOTO]", x: 53, y: 199, fontSize: 8, w: 89, h: 101, color: "#999" },
  { id: "signature", label: "Assinatura (frente)", sampleText: "[ASSINATURA]", x: 171, y: 324, fontSize: 7, w: 140, h: 28, color: "#999" },
  { id: "estado", label: "Estado (cabeçalho)", sampleText: "AMAZONAS", x: 243, y: 142, fontSize: 9 },
  { id: "nome", label: "Nome", sampleText: "HUELLISON DOS SANTOS CASTRO", x: 159, y: 202, fontSize: 9 },
  { id: "nome_social", label: "Nome Social", sampleText: "NOME SOCIAL", x: 159, y: 232, fontSize: 9 },
  { id: "registro_geral", label: "Registro Geral - CPF", sampleText: "02770162233", x: 160, y: 263, fontSize: 9 },
  { id: "sexo", label: "Sexo", sampleText: "M", x: 298, y: 261, fontSize: 11 },
  { id: "data_nascimento", label: "Data de Nascimento", sampleText: "23/10/1993", x: 160, y: 285, fontSize: 9 },
  { id: "nacionalidade", label: "Nacionalidade", sampleText: "BRA", x: 300, y: 285, fontSize: 9 },
  { id: "naturalidade", label: "Naturalidade", sampleText: "MANAUS - AM", x: 160, y: 307, fontSize: 9 },
  { id: "data_validade", label: "Data de Validade", sampleText: "23/05/2035", x: 300, y: 308, fontSize: 9 },
  // Verso
  { id: "qr", label: "QR Code (validação)", sampleText: "[QR]", x: 50, y: 437, fontSize: 8, w: 82, h: 82, color: "#999" },
  { id: "qr2", label: "QR Code grande (lateral)", sampleText: "[QR]", x: 504, y: 94, fontSize: 8, w: 240, h: 240, color: "#999" },
  { id: "photo2", label: "Foto 3x4 (verso)", sampleText: "[FOTO]", x: 397, y: 421, fontSize: 8, w: 36, h: 37, color: "#999" },
  { id: "filiacao1", label: "Filiação 1 (mãe)", sampleText: "MARIA RAIMUNDA DA COSTA DOS SANTOS", x: 152, y: 433, fontSize: 9 },
  { id: "filiacao2", label: "Filiação 2 (pai)", sampleText: "JOSE LUIZ DE SOUZA CASTRO", x: 153, y: 451, fontSize: 9 },
  { id: "orgao_expedidor", label: "Órgão Expedidor", sampleText: "SSP-AM", x: 154, y: 482, fontSize: 9 },
  { id: "local_emissao", label: "Local de emissão", sampleText: "AM", x: 154, y: 517, fontSize: 9 },
  { id: "data_emissao", label: "Data de Emissão", sampleText: "23/05/2025", x: 328, y: 517, fontSize: 9 },
  {
    id: "mrz",
    label: "MRZ",
    sampleText: "IDBRA0277016223302770162233<<0\n931023M350523BRA<<<<<<<<<<<<<2\nHUELLISON<<DOS<SANTOS<CASTRO<<",
    x: 58,
    y: 598,
    fontSize: 16,
  },
  // Outras informações
  { id: "titulo_eleitor", label: "Título de eleitor", sampleText: "80977225463859", x: 40, y: 743, fontSize: 9 },
  { id: "tipo_sanguineo", label: "Tipo sanguíneo", sampleText: "A+", x: 297, y: 744, fontSize: 9 },
  { id: "estado_civil", label: "Estado civil", sampleText: "SOLTEIRO(A)", x: 39, y: 774, fontSize: 9 },
  { id: "doador", label: "Doador de Orgãos", sampleText: "NÃO", x: 296, y: 774, fontSize: 9 },
  { id: "signature2", label: "Assinatura (outras info)", sampleText: "[ASSINATURA]", x: 49, y: 809, fontSize: 10, w: 90, h: 33, color: "#999" },
  { id: "certidao", label: "Certidão", sampleText: "MANAUS - AM 1.SUBD. CN:LV E672/FLS.180 /N°43474", x: 214, y: 805, fontSize: 8.5 },
  { id: "cnh", label: "CNH", sampleText: "78764532553", x: 40, y: 861, fontSize: 9 },
  { id: "categoria", label: "Categoria", sampleText: "A", x: 176, y: 861, fontSize: 9 },
  { id: "pis_pasep", label: "PIS / PASEP", sampleText: "35345879603", x: 310, y: 862, fontSize: 9 },
  { id: "nis", label: "NIS", sampleText: "22146118198", x: 40, y: 891, fontSize: 9 },
  { id: "nit", label: "NIT", sampleText: "09856951890", x: 175, y: 893, fontSize: 9 },
  { id: "ctps", label: "Carteira de trabalho", sampleText: "9000611119111", x: 310, y: 893, fontSize: 9 },
  { id: "dni", label: "DNI", sampleText: "4594798348", x: 40, y: 923, fontSize: 9 },
  { id: "cns", label: "CNS", sampleText: "221869890104006", x: 295, y: 923, fontSize: 9 },
  { id: "observacao_saude", label: "Observação de Saúde", sampleText: "-", x: 42, y: 955, fontSize: 11 },
];

// Defaults MUST match supabase/functions/generate-atestado-pdf/index.ts ATESTADO_DEFAULT_POSITIONS
export const defaultAtestadoFields: FieldDef[] = [
  { id: "qr", label: "QR Code (topo)", sampleText: "[QR]", x: 630, y: 30, fontSize: 8, w: 134, h: 134, color: "#999" },
  { id: "endereco1", label: "Endereço - linha 1", sampleText: "Av. Miguel Ignácio Curi, 41", x: 386, y: 100, fontSize: 14.7, bold: true },
  { id: "endereco2", label: "Endereço - linha 2", sampleText: "Vila Carmosina - São Paulo – SP", x: 386, y: 114.5, fontSize: 14.7, bold: true },
  { id: "endereco3", label: "Endereço - linha 3", sampleText: "CEP: 08295-005", x: 386, y: 128, fontSize: 14.7, bold: true },
  { id: "paciente", label: "Paciente (PARA:)", sampleText: "PARA: TATIANI RODRIGUES MOR", x: 118, y: 265.5, fontSize: 20 },
  {
    id: "corpo",
    label: "Texto do atestado",
    sampleText:
      "Atesto para os devidos fins, que o(a), TATIANI RODRIGUES MOR, CNS: 801440458570767 foi atendido(a) no(a), UPA 24h Itaquera - Consultórios na data 08/11/2023 ás 05:53:23, necessitando de 1 (Um) dia de repouso por motivo de doença.",
    x: 18,
    y: 337.5,
    fontSize: 20,
  },
  { id: "cid", label: "CID", sampleText: "CID: 10", x: 17, y: 423, fontSize: 24 },
  { id: "cidade_data", label: "Unidade + data por extenso", sampleText: "UPA 24h Itaquera, 08 de Novembro de 2023", x: 364, y: 564.5, fontSize: 20 },
  { id: "emitido_em", label: "Emitido em", sampleText: "Emitido em: 08/11/2023 05:54:23", x: 39, y: 898, fontSize: 10.2, bold: true },
  { id: "liberado", label: "Liberado e assinado", sampleText: "Liberado e assinado\neletronicamente em 08/11/2023\n09:38 por:", x: 398, y: 902, fontSize: 12.75, bold: true },
  { id: "qr2", label: "QR Code (rodapé)", sampleText: "[QR]", x: 400, y: 955, fontSize: 8, w: 95, h: 95, color: "#999" },
];

// Defaults MUST match supabase/functions/generate-hapvida-pdf/index.ts HAPVIDA_DEFAULT_POSITIONS
export const defaultHapvidaFields: FieldDef[] = [
  { id: "endereco1", label: "Endereço - linha 1", sampleText: "Av. Heráclito Graça, 1001 - Centro, Fortaleza-CE,", x: 344, y: 32, fontSize: 13.4, w: 400, color: "#6b6b6b" },
  { id: "endereco2", label: "Endereço - linha 2", sampleText: "CEP: 60140-090 | Telefone: (85) 9 4002-3633", x: 344, y: 53.6, fontSize: 13.4, w: 400, color: "#6b6b6b" },
  { id: "consulte", label: "Consulte a prescrição", sampleText: "Consulte a prescrição acessando", x: 486, y: 138, fontSize: 10.4, w: 260, color: "#6b6b6b" },
  { id: "link", label: "Link da prescrição", sampleText: "https://tinyurl.com/abcdefgh ou", x: 486, y: 151.4, fontSize: 10.4, w: 260, color: "#6b6b6b" },
  { id: "qr", label: "QR Code (validação)", sampleText: "[QR]", x: 658, y: 172, fontSize: 8, w: 87, h: 87, color: "#999" },
  { id: "paciente", label: "Paciente", sampleText: "PATRICK DE MOURA CARVALHO", x: 42.2, y: 151, fontSize: 12.4, bold: true },
  { id: "cpf", label: "CPF / CNS", sampleText: "CPF: 701.632.856-08", x: 42.2, y: 174, fontSize: 12.4 },
  { id: "celular", label: "Celular", sampleText: "Celular: (34) 99649-7562", x: 42.2, y: 194, fontSize: 12.4 },
  { id: "tipo_atendimento", label: "Tipo de atendimento", sampleText: "Tipo de atendimento:  Urgência", x: 42.2, y: 215.8, fontSize: 12.4 },
  {
    id: "corpo",
    label: "Texto do atestado",
    sampleText:
      "Atesto, para os devidos fins, que PATRICK DE MOURA CARVALHO, portador do CPF/CNS nº 701.632.856-08, foi submetido a uma consulta médica na data de hoje, 27/01/2025 09:46 hrs, sendo diagnosticado como portador da afecção CID-M54.",
    x: 42.2,
    y: 389.8,
    fontSize: 14.6,
    w: 700,
  },
  { id: "data_emissao", label: "Data de emissão", sampleText: "Data de emissão: 27/01/2025", x: 42.2, y: 847.3, fontSize: 14.6 },
  { id: "medico", label: "Médico(a)", sampleText: "CARINE GONÇALVES LOPES PIETRZAKI", x: 42.2, y: 942.1, fontSize: 12.4, bold: true },
  { id: "crm", label: "CRM + especialidade", sampleText: "CRM 210827SP -  CLÍNICA MÉDICA", x: 42.2, y: 963.1, fontSize: 12.4, color: "#6b6b6b" },
  { id: "assinatura", label: "Assinatura (nome)", sampleText: "CARINE GONÇALVES LOPES PIETRZAKI", x: 400, y: 933, fontSize: 9.6, w: 92, bold: true },
  { id: "assinatura_info", label: "Assinatura digital (info)", sampleText: "Digitally signed by\nCARINE GONÇALVES LOPES PIETRZAKI", x: 625, y: 935.5, fontSize: 9.1, w: 150, color: "#6b6b6b" },
];

// Defaults MUST match supabase/functions/generate-unimed-pdf/index.ts UNIMED_DEFAULT_POSITIONS
export const defaultUnimedFields: FieldDef[] = [
  { id: "unidade", label: "Unidade (cabeçalho)", sampleText: "TELESSAUDE - UNIMEDRJ", x: 191, y: 18.9, fontSize: 10.3, w: 400 },
  { id: "endereco", label: "Endereço da unidade", sampleText: "AV ATLÂNTICA, 2440 - APT 1008, RIO DE JANEIRO - RJ, 22041-901", x: 191, y: 33.8, fontSize: 8.3, w: 480 },
  { id: "lbl_paciente", label: "Rótulo: Nome do paciente", sampleText: "Nome do paciente:", x: 18.6, y: 54.8, fontSize: 10.3 },
  { id: "lbl_prontuario", label: "Rótulo: Nº Pront.", sampleText: "Nº Pront.:", x: 435.1, y: 54.8, fontSize: 10.3 },
  { id: "lbl_atendimento", label: "Rótulo: Nº Atend.", sampleText: "N° Atend.", x: 610.9, y: 54.8, fontSize: 10.3 },
  { id: "lbl_nascimento", label: "Rótulo: Data de Nascimento", sampleText: "Data de Nascimento:", x: 18.6, y: 75.4, fontSize: 10.3 },
  { id: "lbl_convenio", label: "Rótulo: Convênio", sampleText: "Convênio:", x: 425.9, y: 75.4, fontSize: 10.3 },
  { id: "lbl_mae", label: "Rótulo: Nome da mãe", sampleText: "Nome da mãe:", x: 19.6, y: 96.2, fontSize: 10.3 },
  { id: "lbl_setor", label: "Rótulo: Setor", sampleText: "Setor:", x: 425.9, y: 94, fontSize: 10.3 },
  { id: "lbl_leito", label: "Rótulo: Leito", sampleText: "Leito:", x: 706.1, y: 96.2, fontSize: 10.3 },
  { id: "lbl_profissional", label: "Rótulo: Profissional", sampleText: "Profissional:", x: 20.7, y: 116.7, fontSize: 10.3 },
  { id: "lbl_data_assinatura", label: "Rótulo: Data Assinatura", sampleText: "Data Assinatura:", x: 425.9, y: 111.4, fontSize: 10.3 },
  { id: "lbl_titulo", label: "Título ATESTADO MÉDICO", sampleText: "ATESTADO MÉDICO", x: 324.7, y: 161.8, fontSize: 12.4 },
  { id: "paciente", label: "Nome do paciente", sampleText: "VICTORIA GABRIELA COSTA PEREIRA", x: 138.6, y: 52.7, fontSize: 10.3 },
  { id: "prontuario", label: "Nº Prontuário", sampleText: "005592173", x: 516.9, y: 52.6, fontSize: 10.3 },
  { id: "atendimento", label: "Nº Atendimento", sampleText: "2290479", x: 688.5, y: 52.7, fontSize: 10.3 },
  { id: "nascimento", label: "Data de nascimento", sampleText: "14/08/2000", x: 138.6, y: 75.4, fontSize: 10.3 },
  { id: "idade", label: "Idade", sampleText: "Idade:24 Anos", x: 223.3, y: 75.4, fontSize: 10.3 },
  { id: "convenio", label: "Convênio", sampleText: "UNIMED RJ", x: 516.9, y: 73.2, fontSize: 10.3 },
  { id: "mae", label: "Nome da mãe", sampleText: "DANIELE COSTA PEREIRA", x: 137.8, y: 96.2, fontSize: 10.3 },
  { id: "setor", label: "Setor", sampleText: "-", x: 470, y: 94, fontSize: 10.3 },
  { id: "leito", label: "Leito", sampleText: "-", x: 730, y: 96.2, fontSize: 10.3 },
  { id: "data_assinatura", label: "Data da assinatura", sampleText: "11/12/2024 13:00:21", x: 517.1, y: 111.4, fontSize: 10.3 },
  { id: "profissional", label: "Profissional", sampleText: "MARIA CAROLINA CARIANO DA SILVA", x: 138.6, y: 115, fontSize: 10.3 },
  {
    id: "corpo",
    label: "Texto do atestado",
    sampleText:
      "Atesto para os devidos fins, a pedido que o(a) Sr(a). VICTORIA GABRIELA COSTA PEREIRA, inscrito(a) no CPF sob o n 148.230.176-84, paciente sob meus cuidado, foi atendido(a) no dia 11/12/24 as 13:00 apresentando quadro de choque alérgico (anafilaxia).",
    x: 61.3,
    y: 191,
    fontSize: 12.4,
    w: 665,
  },
  {
    id: "decreto",
    label: "Parágrafo do Decreto",
    sampleText:
      "(Este atestado é válido para as finalidades previstas nos artigos 71 e 72, parágrafo 1ª do Decreto 3048/99, e será expedido para justificar o afastamento do trabalho 01 dias).",
    x: 58.4,
    y: 282.6,
    fontSize: 12.4,
    w: 655,
  },
  {
    id: "autorizo",
    label: "Autorização do CID",
    sampleText: "Eu, VICTORIA GABRIELA COSTA PEREIRA, autorizo a inclusão da CID T782 no atestado médico.",
    x: 58.4,
    y: 327.9,
    fontSize: 12.4,
    w: 655,
  },
  { id: "nome_linha", label: "Nome sobre a linha", sampleText: "VICTORIA GABRIELA COSTA PEREIRA", x: 178.2, y: 463.7, fontSize: 10.3 },
  { id: "assinatura_img", label: "Assinatura (foto enviada)", sampleText: "[Assinatura]", x: 263, y: 470, fontSize: 8, w: 280, h: 100, color: "#999" },
  { id: "assinatura_digital", label: "Assinatura digital (ICP)", sampleText: "MARIA CAROLINA CARIANO DA SILVA: 0121699, AC CNDL RFB v3, 0121699, 11/12/2024 13:00 BRT 11/12/2024", x: 36.2, y: 775, fontSize: 6.2, w: 420 },
  { id: "qr", label: "QR Code (validação)", sampleText: "[QR]", x: 568, y: 718, fontSize: 8, w: 72, h: 72, color: "#999" },
  { id: "rodape_impresso", label: "Rodapé - Impresso em", sampleText: "Impresso em: 11/12/2024 13:00", x: 10.3, y: 1095.1, fontSize: 10.3 },
  { id: "rodape_criado", label: "Rodapé - Criado por", sampleText: "Criado por: MARIA CAROLINA CARIANO DA SILVA", x: 198.1, y: 1095.1, fontSize: 10.3 },
  { id: "rodape_crm", label: "Rodapé - CRM", sampleText: "CRM-RJ: 0121699", x: 565.4, y: 1095.1, fontSize: 10.3 },
];



// Defaults MUST match supabase/functions/generate-crlv-pdf/index.ts CRLV_DEFAULT_POSITIONS
export const defaultCrlvFields: FieldDef[] = [
  { id: "detran_uf", label: "DETRAN - UF", sampleText: "DETRAN- PE", x: 41.3, y: 72.6, fontSize: 5.9 },
  { id: "titulo", label: "Título do documento", sampleText: "CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEÍCULO - DIGITAL", x: 41.3, y: 86.3, fontSize: 8.5, bold: true },
  { id: "qr", label: "QR Code (validação)", sampleText: "[QR]", x: 214.7, y: 115.6, fontSize: 8, w: 146, h: 146, color: "#999" },
  { id: "renavam", label: "Código RENAVAM", sampleText: "00335436552", x: 41.5, y: 134.6, fontSize: 13.3 },
  { id: "placa", label: "Placa", sampleText: "NQK8I74", x: 41.5, y: 169.5, fontSize: 13.3 },
  { id: "exercicio", label: "Exercício", sampleText: "2023", x: 136.9, y: 169.5, fontSize: 13.3 },
  { id: "ano_fabricacao", label: "Ano de fabricação", sampleText: "2011", x: 41.5, y: 204.6, fontSize: 13.3 },
  { id: "ano_modelo", label: "Ano do modelo", sampleText: "2011", x: 136.9, y: 204.6, fontSize: 13.3 },
  { id: "numero_crv", label: "Número do CRV", sampleText: "213012407278", x: 41.5, y: 239.6, fontSize: 13.3 },
  { id: "codigo_cla", label: "Código de segurança do CLA", sampleText: "02775028150", x: 41.5, y: 343.1, fontSize: 13.3 },
  { id: "cat", label: "CAT", sampleText: "***", x: 216.5, y: 343.1, fontSize: 13.3 },
  { id: "marca_modelo", label: "Marca / Modelo / Versão", sampleText: "VW/8.120 EURO3", x: 41.5, y: 390.1, fontSize: 13.3 },
  { id: "especie_tipo", label: "Espécie / Tipo", sampleText: "CARGA CAMINHAO", x: 41.5, y: 437.1, fontSize: 13.3 },
  { id: "placa_anterior", label: "Placa anterior / UF", sampleText: "NQK8874/RN", x: 41.5, y: 484.2, fontSize: 13.3 },
  { id: "chassi", label: "Chassi", sampleText: "9533452R8BR155089", x: 174.2, y: 484.2, fontSize: 13.3 },
  { id: "cor", label: "Cor predominante", sampleText: "VERMELHA", x: 41.5, y: 531.1, fontSize: 13.3 },
  { id: "combustivel", label: "Combustível", sampleText: "DIESEL", x: 136.9, y: 531.1, fontSize: 13.3 },
  { id: "observacoes", label: "Observações", sampleText: "CARGA,", x: 37.5, y: 590, fontSize: 13.3 },
  { id: "categoria", label: "Categoria", sampleText: "ALUGUEL", x: 421.8, y: 96.3, fontSize: 13.3 },
  { id: "capacidade", label: "Capacidade", sampleText: "4.74", x: 679.9, y: 116, fontSize: 13.3 },
  { id: "potencia", label: "Potência / Cilindrada", sampleText: "115CV/4300", x: 421.8, y: 151, fontSize: 13.3 },
  { id: "peso_bruto", label: "Peso bruto total", sampleText: "7.7", x: 679.9, y: 151, fontSize: 13.3 },
  { id: "motor", label: "Motor", sampleText: "E2T03816", x: 421.8, y: 186.1, fontSize: 13.3 },
  { id: "cmt", label: "CMT", sampleText: "10.5", x: 604.9, y: 186.1, fontSize: 13.3 },
  { id: "eixos", label: "Eixos", sampleText: "2", x: 672.8, y: 186.1, fontSize: 13.3 },
  { id: "lotacao", label: "Lotação", sampleText: "03P", x: 718.1, y: 186.1, fontSize: 13.3 },
  { id: "carroceria", label: "Carroceria", sampleText: "CARROCERIA FECHADA", x: 421.8, y: 221, fontSize: 13.3 },
  { id: "nome", label: "Nome do proprietário", sampleText: "MARIA JOSE RODRIGUES XAVIER", x: 421.8, y: 253.8, fontSize: 13.3 },
  { id: "cpf_cnpj", label: "CPF / CNPJ", sampleText: "744.088.444-20", x: 617.4, y: 296.1, fontSize: 13.3 },
  { id: "local", label: "Local", sampleText: "JUREMA PE", x: 421.8, y: 343.1, fontSize: 13.3 },
  { id: "data", label: "Data", sampleText: "25/04/2023", x: 679.9, y: 343.1, fontSize: 13.3 },
  { id: "cat_tarif", label: "DPVAT - Cat. tarifária", sampleText: "*", x: 421.8, y: 428.4, fontSize: 13.3 },
  { id: "data_quitacao", label: "DPVAT - Data de quitação", sampleText: "*", x: 518.9, y: 428.4, fontSize: 13.3 },
  { id: "repasse_fns", label: "DPVAT - Repasse FNS", sampleText: "*", x: 421.8, y: 478.7, fontSize: 13.3 },
  { id: "custo_bilhete", label: "DPVAT - Custo do bilhete", sampleText: "*", x: 564.9, y: 478.7, fontSize: 13.3 },
  { id: "custo_efetivo", label: "DPVAT - Custo efetivo", sampleText: "*", x: 659.3, y: 478.7, fontSize: 13.3 },
  { id: "repasse_denatran", label: "DPVAT - Repasse DENATRAN", sampleText: "*", x: 421.8, y: 533, fontSize: 13.3 },
  { id: "valor_iof", label: "DPVAT - Valor do IOF", sampleText: "*", x: 564.9, y: 533, fontSize: 13.3 },
  { id: "valor_total", label: "DPVAT - Valor total", sampleText: "*", x: 659.3, y: 533, fontSize: 13.3 },
];

// Defaults MUST match supabase/functions/generate-cha-pdf/index.ts CHA_DEFAULT_POSITIONS
export const defaultChaFields: FieldDef[] = [
  { id: "qr", label: "QR Code (validação)", sampleText: "[QR]", x: 541, y: 128, fontSize: 8, w: 158, h: 158, color: "#999" },
  { id: "photo", label: "Foto 3x4", sampleText: "[FOTO]", x: 311, y: 209, fontSize: 8, w: 110, h: 116, color: "#999" },
  { id: "nome", label: "Nome", sampleText: "ADEMAR SOUSA", x: 79.7, y: 215.5, fontSize: 10.5 },
  { id: "nascimento", label: "Data de nascimento", sampleText: "03/02/1998", x: 88.3, y: 245.8, fontSize: 10.5 },
  { id: "cpf", label: "CPF", sampleText: "021.020.120-77", x: 199.2, y: 245.8, fontSize: 10.5 },
  { id: "categoria", label: "Categoria", sampleText: "MOTONAUTA", x: 79.7, y: 273.6, fontSize: 10.5 },
  { id: "categoria_en", label: "Categoria (inglês)", sampleText: "PERSONAL WATERCRAFT PILOT", x: 79.7, y: 284.7, fontSize: 10.5 },
  { id: "validade", label: "Data de validade", sampleText: "07/07/2031", x: 88.3, y: 306.7, fontSize: 10.5 },
  { id: "inscricao", label: "Nº de inscrição", sampleText: "085A2020066044", x: 199.2, y: 306.7, fontSize: 10.5 },
  { id: "foto_data", label: "Selo de data (foto)", sampleText: "09/07/2026", x: 349.5, y: 316.9, fontSize: 5, bold: true },
  { id: "limites", label: "Limites da navegação", sampleText: "INTERIOR. / INLAND WATERS.", x: 80.6, y: 419.6, fontSize: 10.5 },
  { id: "requisitos", label: "Requisitos", sampleText: "******** / ********", x: 80.6, y: 459.9, fontSize: 10.5 },
  { id: "orgao", label: "Órgão de emissão", sampleText: "MARINHA DO BRASIL", x: 80.6, y: 503.1, fontSize: 10.5 },
  { id: "data_emissao", label: "Data de emissão", sampleText: "07/07/2026", x: 302.4, y: 503.1, fontSize: 10.5 },
];

// Defaults MUST match supabase/functions/generate-diploma-pdf/index.ts DIPLOMA_DEFAULT_POSITIONS
// Espaço 1288 x 1732: página 1 em y 0–866, página 2 em y 866–1732.
export const defaultDiplomaFields: FieldDef[] = [
  { id: "rep_federativa", label: "República Federativa", sampleText: "REPÚBLICA FEDERATIVA DO BRASIL", x: 644, y: 136.7, fontSize: 13.5 },
  { id: "ministerio", label: "Ministério da Educação", sampleText: "MINISTÉRIO DA EDUCAÇÃO", x: 644, y: 152.4, fontSize: 13.5 },
  { id: "inst_l1", label: "Instituição - linha 1", sampleText: "CENTRO UNIVERSITÁRIO", x: 644, y: 174, fontSize: 31 },
  { id: "inst_l2", label: "Instituição - linha 2", sampleText: "ESTÁCIO DO CEARÁ", x: 644, y: 213, fontSize: 31 },
  { id: "corpo", label: "Texto do diploma", sampleText: "O(A) Reitor(a) do CENTRO UNIVERSITÁRIO ESTÁCIO DO CEARÁ, no uso de suas atribuições, tendo em vista a conclusão do CURSO SUPERIOR DE TECNOLOGIA EM DESIGN DE MODA, na data de 10/07/2015, e a colação de grau na data de 31/08/2015, confere o título de TECNÓLOGO (A) a GUSTAVO AUGUSTO RODRIGUES DA SILVA, nacionalidade BRASILEIRO(A), natural de CEARÁ, nascido(a) em 31/10/1992, portador(a) da Cédula de Identidade 2009010328577, órgão expedidor SSPDS/CE, e outorga-lhe o presente Diploma, a fim de que possa gozar de todos os direitos e prerrogativas legais.", x: 644, y: 283, fontSize: 15.5 },
  { id: "cidade_data", label: "Cidade e data", sampleText: "Fortaleza - CE, 14 de Junho de 2023.", x: 721, y: 555, fontSize: 15.5 },
  { id: "reitor", label: "Reitor(a)", sampleText: "JOSUÉ VIANA DE OLIVEIRA NETO", x: 1032, y: 663, fontSize: 12.5 },
  { id: "rodape_inst", label: "Rodapé - instituição", sampleText: "CENTRO UNIVERSITÁRIO ESTÁCIO DO CEARÁ", x: 644, y: 751, fontSize: 13 },
  { id: "rodape_validacao", label: "Rodapé - validação", sampleText: "Código de Validação: 1107.163.e6c296281d3f | https://consultadiploma.estacio.br/diploma/1107.163.e6c296281d3f", x: 644, y: 767, fontSize: 11.5 },
  { id: "p2_esq_nome", label: "V. Instituição (esq.)", sampleText: "CENTRO UNIVERSITÁRIO ESTÁCIO DO CEARÁ", x: 30.4, y: 927.8, fontSize: 11.5, bold: true },
  { id: "p2_esq_razao", label: "V. Mantenedora + CNPJ", sampleText: "SOCIEDADE DE ENSINO SUPERIOR, MÉDIO E FUNDAMENTAL LTDA\nCNPJ: 02608755000107", x: 30.4, y: 954.4, fontSize: 11.5 },
  { id: "p2_esq_cred", label: "V. Credenciamento", sampleText: "Credenciamento: Portaria nº 1097, de 31/8/2012, DOU nº 172, Seção 1, Pág. 97, de 4/9/2012.", x: 30.4, y: 997.8, fontSize: 11.5 },
  { id: "p2_esq_recred", label: "V. Recredenciamento", sampleText: "Recredenciamento: Portaria nº 684, de 16/7/2018, DOU nº 136, Seção 1, Pág. 12, de 17/7/2018.", x: 30.4, y: 1040.7, fontSize: 11.5 },
  { id: "p2_curso", label: "V. Curso", sampleText: "Curso de DESIGN DE MODA", x: 30.4, y: 1099.2, fontSize: 11.5, bold: true },
  { id: "p2_reconhecimento", label: "V. Reconhecimento", sampleText: "Reconhecimento: Portaria MEC n° 13, de 02/03/2012, DOU n° 45,\nSeção 1, Pág. 55, de 06/03/2012.", x: 30.4, y: 1120.4, fontSize: 11.5 },
  { id: "p2_renovacao", label: "V. Renovação", sampleText: "Renovação: Portaria MEC n° 948, de 30/08/2021, DOU n° 165,\nSeção 1, Pág. 36, de 31/08/2021.", x: 30.4, y: 1159, fontSize: 11.5 },
  { id: "p2_dir_recred", label: "V. Recred. universidade", sampleText: "Recredenciamento: Portaria nº 1095, de 31/8/2012, DOU nº 172, Seção 1, Pág. 97, de 4/9/2012.", x: 671.4, y: 1063.3, fontSize: 11.5 },
  { id: "p2_registro", label: "V. Registro do diploma", sampleText: "Diploma registrado sob o n° 11897, Livro 1, fls 2084, em 14/06/2023, por delegação de competência do Ministério da Educação, nos termos da Lei nº 9.394 de 20 de dezembro de 1996, e do Decreto nº 9.235, de 15 de dezembro de 2017.", x: 671.4, y: 1121.6, fontSize: 11.5 },
  { id: "p2_processo", label: "V. Processo", sampleText: "Processo n° SRD/6351166-IP/2023.", x: 671.4, y: 1189.6, fontSize: 11.5 },
  { id: "p2_cidade_data", label: "V. Cidade e data", sampleText: "Rio de Janeiro - RJ, 14/06/2023", x: 671.4, y: 1230.1, fontSize: 11.5 },
  { id: "secretario", label: "V. Secretário(a)", sampleText: "ADRIANA SILVA ARAUJO", x: 958, y: 1309, fontSize: 11.5 },
  { id: "resolucao", label: "V. Resolução", sampleText: "Resolução 092/GR/2016", x: 958, y: 1343, fontSize: 11 },
  { id: "qr", label: "QR Code (validação)", sampleText: "[QR]", x: 1032, y: 1515, fontSize: 8, w: 110, h: 110, color: "#999" },
  { id: "serial", label: "V. Nº de série", sampleText: "6070002386077", x: 1144, y: 1636, fontSize: 11, bold: true },
];

// Defaults MUST match supabase/functions/generate-historico-pdf/index.ts HISTORICO_DEFAULT_POSITIONS
export const defaultHistoricoFields: FieldDef[] = [
  { id: "brasao", label: "Brasão do estado", sampleText: "[BRASÃO]", x: 108, y: 34, fontSize: 10, w: 80, h: 90 },
  { id: "gov_estado", label: "Governo do estado", sampleText: "GOVERNO DO ESTADO DE ALAGOAS", x: 203.1, y: 38.4, fontSize: 15.5, w: 400, bold: true },
  { id: "secretaria", label: "Secretaria", sampleText: "SECRETARIA DE ESTADO DA EDUCAÇÃO", x: 203.1, y: 59.1, fontSize: 12, w: 400 },
  { id: "diretoria", label: "Diretoria de ensino", sampleText: "DIRETORIA DE ENSINO – REGIÃO DE AL", x: 203.1, y: 77.4, fontSize: 12, w: 400 },
  { id: "escola", label: "Escola", sampleText: "ESCOLA ESTADUAL PROFESSORA MARIA AVELINA DO CARMO", x: 198.3, y: 93.4, fontSize: 13, w: 470 },
  { id: "ato_legal", label: "Ato legal", sampleText: "Ato Legal de Criação: 124.761.98 – ADR", x: 203.1, y: 111, fontSize: 10.8, w: 400 },
  { id: "endereco", label: "Endereço", sampleText: "Endereço: R. Isac Pereira Neto", x: 203.1, y: 125.4, fontSize: 10.8, w: 420 },
  { id: "numero", label: "Número", sampleText: "nº 395-441", x: 645.5, y: 125.4, fontSize: 10.8 },
  { id: "bairro", label: "Bairro", sampleText: "Bairro: Centro", x: 203.1, y: 139.9, fontSize: 10.8 },
  { id: "municipio_escola", label: "Município da escola", sampleText: "Município: Traipu", x: 366.1, y: 139.9, fontSize: 10.8 },
  { id: "cep", label: "CEP", sampleText: "CEP: 57370-000", x: 609.7, y: 139.9, fontSize: 10.8 },
  { id: "telefone", label: "Telefone", sampleText: "Tell: (82) 3536-1361", x: 201.7, y: 163.5, fontSize: 10.8 },

  { id: "nome_aluno", label: "Nome do aluno", sampleText: "Claudeane Damásio Silva", x: 153.8, y: 222.2, fontSize: 12, w: 290 },
  { id: "rg_rne", label: "RG / RNE", sampleText: "RG/RNE: 56.191.320-1", x: 459.4, y: 222.3, fontSize: 11, w: 150 },
  { id: "ra", label: "RA", sampleText: "RA: 284193875-1", x: 614.3, y: 222.2, fontSize: 12, w: 165 },
  { id: "municipio_nasc", label: "Município de nascimento", sampleText: "Município: Batalha", x: 198.3, y: 238.2, fontSize: 12, w: 250 },
  { id: "estado_nasc", label: "Estado", sampleText: "Estado: AL", x: 459.4, y: 238.2, fontSize: 12, w: 145 },
  { id: "pais", label: "País", sampleText: "País: Brasil", x: 614.3, y: 238.2, fontSize: 12, w: 165 },
  { id: "data_nasc", label: "Data de nascimento", sampleText: "Data: 03/04/1995", x: 198.3, y: 254.2, fontSize: 12, w: 250 },
  { id: "mae", label: "Mãe", sampleText: "Mãe: Ana Paula santeiro da Silva", x: 459.4, y: 254.2, fontSize: 12, w: 320 },

  { id: "ano1", label: "Ano da 1ª série", sampleText: "2013", x: 545.6, y: 273.3, fontSize: 11 },
  { id: "ano2", label: "Ano da 2ª série", sampleText: "2014", x: 595.5, y: 273.3, fontSize: 11 },
  { id: "ano3", label: "Ano da 3ª série", sampleText: "2015", x: 645.4, y: 273.3, fontSize: 11 },

  { id: "ef_ano", label: "EF · Ano", sampleText: "2011", x: 256.5, y: 743.4, fontSize: 11 },
  { id: "ef_estab", label: "EF · Estabelecimento", sampleText: "Escola municipal de educação básica Francisco Mangabeiras", x: 294.6, y: 736.4, fontSize: 11, w: 292 },
  { id: "ef_mun", label: "EF · Município", sampleText: "Traipu", x: 613.9, y: 743.4, fontSize: 11, w: 82 },
  { id: "ef_uf", label: "EF · UF", sampleText: "AL", x: 704, y: 743.4, fontSize: 11 },

  { id: "e1_ano", label: "1ª Série · Ano", sampleText: "2013", x: 256.5, y: 769.4, fontSize: 11 },
  { id: "e1_estab", label: "1ª Série · Estabelecimento", sampleText: "Escola estadual Professora Maria Avelina do Carmo.", x: 294.6, y: 769.4, fontSize: 11, w: 292 },
  { id: "e1_mun", label: "1ª Série · Município", sampleText: "Traipu", x: 615, y: 769.4, fontSize: 11, w: 82 },
  { id: "e1_uf", label: "1ª Série · UF", sampleText: "AL", x: 705, y: 769.4, fontSize: 11 },

  { id: "e2_ano", label: "2ª Série · Ano", sampleText: "2014", x: 256.5, y: 783.9, fontSize: 11 },
  { id: "e2_estab", label: "2ª Série · Estabelecimento", sampleText: "Escola estadual Professora Maria Avelina do Carmo.", x: 294.6, y: 783.9, fontSize: 11, w: 292 },
  { id: "e2_mun", label: "2ª Série · Município", sampleText: "Traipu", x: 615, y: 783.9, fontSize: 11, w: 82 },
  { id: "e2_uf", label: "2ª Série · UF", sampleText: "AL", x: 705, y: 783.9, fontSize: 11 },

  { id: "e3_ano", label: "3ª Série · Ano", sampleText: "2015", x: 256.5, y: 798.3, fontSize: 11 },
  { id: "e3_estab", label: "3ª Série · Estabelecimento", sampleText: "Escola estadual Professora Maria Avelina do Carmo.", x: 294.6, y: 798.3, fontSize: 11, w: 292 },
  { id: "e3_mun", label: "3ª Série · Município", sampleText: "Traipu", x: 615, y: 798.3, fontSize: 11, w: 82 },
  { id: "e3_uf", label: "3ª Série · UF", sampleText: "AL", x: 705, y: 798.3, fontSize: 11 },

  {
    id: "certificado",
    label: "Texto do certificado",
    sampleText:
      "O Diretor da Escola, Escola Estadual Professora Maria Avelina Do Carmo, CERTIFICA, nos termos do Inciso VII, Artigo 24 da Lei Federal 9394/96, que Claudeane Damásio Silva, CONCLUIU a 3ª Série do Ensino Médio REGULAR no ano de 2015.",
    x: 47.1,
    y: 858.3,
    fontSize: 12,
    w: 680,
  },
];

// Defaults MUST match supabase/functions/generate-certidao-pdf/index.ts CERTIDAO_DEFAULT_POSITIONS
export const defaultCertidaoFields: FieldDef[] = [
  { id: "nome", label: "Nome", sampleText: "CAROLINE COAN LEAL", x: 197, y: 243, fontSize: 13.5, w: 400, bold: true },
  { id: "cpf", label: "CPF", sampleText: "073.494.389-07", x: 118, y: 275.5, fontSize: 8.5, w: 200, bold: true },
  { id: "matricula", label: "Matrícula", sampleText: "000687 01 55 1990 1 00031 189 0031464 43", x: 197, y: 301.5, fontSize: 13.5, w: 400, bold: true },
  { id: "nasc_extenso", label: "Nascimento por extenso", sampleText: "VINTE E SETE DE FEVEREIRO DE UM MIL E NOVECENTOS E NOVENTA", x: 116.6, y: 347, fontSize: 8.3, w: 520, bold: true },
  { id: "dia", label: "Dia", sampleText: "27", x: 526, y: 336.5, fontSize: 8.3, w: 40, bold: true },
  { id: "mes", label: "Mês", sampleText: "02", x: 577, y: 336.5, fontSize: 8.3, w: 40, bold: true },
  { id: "ano", label: "Ano", sampleText: "1990", x: 633, y: 336.5, fontSize: 8.3, w: 40, bold: true },
  { id: "hora", label: "Hora de nascimento", sampleText: "23H 20MIN", x: 143, y: 378, fontSize: 8.3, w: 90, bold: true },
  { id: "naturalidade", label: "Naturalidade", sampleText: "SÃO JOSÉ DOS PINHAIS-PR", x: 234, y: 378, fontSize: 8.3, w: 250, bold: true },
  { id: "municipio_registro", label: "Município de registro", sampleText: "SÃO JOSÉ DOS PINHAIS-PR", x: 116.6, y: 418, fontSize: 8.3, w: 240, bold: true },
  { id: "local_nasc", label: "Local de nascimento", sampleText: "NOVACLÍNICA HOSPITAL E MATERNIDADE, SÃO JOSÉ DOS PINHAIS-PR", x: 372, y: 404, fontSize: 7.4, w: 225, bold: true },
  { id: "sexo", label: "Sexo", sampleText: "FEMININO", x: 592, y: 409, fontSize: 8.5, w: 95, bold: true },
  { id: "filiacao", label: "Filiação", sampleText: "JORGE CARLOS FERNANDES LEAL E EDNA MARIA COAN", x: 116.6, y: 448.9, fontSize: 8.3, w: 560, bold: true },
  { id: "avos", label: "Avós", sampleText: "ANTONIO DE FREITAS LEAL, ODETE FERNANDES LEAL, ALFREDO DOMINGO COAN E ERICA PACHECO COAN", x: 116.6, y: 479, fontSize: 8.3, w: 560, bold: true },
  { id: "gemeos", label: "Gêmeos", sampleText: "NÃO", x: 126, y: 509, fontSize: 8.3, w: 55, bold: true },
  { id: "nome_gemeos", label: "Nome/matrícula dos gêmeos", sampleText: "", x: 228, y: 509, fontSize: 8.3, w: 380, bold: true },
  { id: "registro_extenso", label: "Registro por extenso", sampleText: "CINCO DE MARÇO DE UM MIL E NOVECENTOS E NOVENTA", x: 116.6, y: 549, fontSize: 8.3, w: 430, bold: true },
  { id: "lavrada", label: "Texto da lavratura", sampleText: "Certidão lavrada por Valdinei Simões Custodio - Escrevente do Registro Civil das Pessoas Naturais de São José dos Pinhais, o(a) qual assinou eletronicamente aos 01 de Fevereiro de 2023, nos termos do Provimento nº 46/2015 do Conselho Nacional de Justiça", x: 97, y: 627, fontSize: 8.3, w: 600 },
  { id: "dou_fe", label: "Dou fé", sampleText: "O conteúdo da certidão é verdadeiro. Dou fé", x: 97, y: 655.9, fontSize: 8.3, w: 600 },
  { id: "emitida", label: "Emitida em", sampleText: "Certidão emitida em 01 de Fevereiro de 2023", x: 97, y: 672.4, fontSize: 8.3, w: 600 },
  { id: "mp_texto", label: "Texto MP 2200-2", sampleText: "Este é um documento público eletrônico, emitido nos termos da Medida Provisória 2200-2, de 24/08/2001, só tendo validade em formato digital, vedada a sua reprodução.", x: 97, y: 689, fontSize: 8.3, w: 600 },
  { id: "cartorio", label: "Bloco do cartório", sampleText: "Oficial de Registro Civil das Pessoas Naturais\nSão José dos Pinhais - PR\nLidia Kruppizak - Oficial\nRua Doutor Motta Júnior, 1309 - Centro - CEP:\n83005-170\nE-mail: cartorioadmsjp@gmail.com\nTel: (41) 30811616", x: 97, y: 726.6, fontSize: 8.3, w: 310 },
];

// Defaults MUST match supabase/functions/generate-declaracao-pdf/index.ts DECLARACAO_DEFAULT_POSITIONS
export const defaultDeclaracaoFields: FieldDef[] = [
  { id: "brasao", label: "Brasão do estado", sampleText: "", x: 372, y: 47, fontSize: 10, w: 55, h: 65 },
  { id: "gov_estado", label: "Governo do estado", sampleText: "GOVERNO DO ESTADO DE SÃO PAULO", x: 97, y: 116.5, fontSize: 14.7, w: 600 },
  { id: "secretaria", label: "Secretaria", sampleText: "SECRETARIA DE ESTADO DA EDUCAÇÃO", x: 97, y: 136, fontSize: 14.7, w: 600 },
  { id: "corpo", label: "Corpo da declaração", sampleText: "Declaro para os devidos fins de direito que Rafael Santos Silva de Matos, natural de São Paulo, nascido (a) em 15/08/1998, filho (a) legítima de Marcia Maria Santos Silva e José Carlos de Oliveira Matos, CONCLUIU o 3º ano do Ensino Médio REGULAR neste estabelecimento de ensino ESCOLA ESTADUAL ROBERTO FREITAS, no ano letivo de 2015. Cujo término do ano letivo aconteceu no dia 12 de DEZEMBRO de 2015 com apresentação do Resultado Final.", x: 112.6, y: 292, fontSize: 16, w: 570 },
  { id: "data_local", label: "Data e local", sampleText: "04 de Dezembro de 2022, São Paulo - SP", x: 97, y: 623, fontSize: 16, w: 600 },
];

// Defaults MUST match supabase/functions/generate-receita-pdf/index.ts RECEITA_DEFAULT_POSITIONS
export const defaultReceitaFields: FieldDef[] = [
  { id: "unidade_cidade", label: "Cidade da unidade", sampleText: "Vitória", x: 45, y: 76.5, fontSize: 9.5, w: 170, color: "#ffffff", bold: true },
  { id: "lbl_paciente", label: "Rótulo: Paciente", sampleText: "Paciente:", x: 35.5, y: 112, fontSize: 9.5, bold: true },
  { id: "paciente", label: "Nome do paciente", sampleText: "TACILA CERQUEIRA LOPES", x: 35.5, y: 126, fontSize: 15.3, w: 470, bold: true },
  { id: "lbl_cpf", label: "Rótulo: CPF", sampleText: "CPF do Paciente:", x: 35.5, y: 158.5, fontSize: 9.5, bold: true },
  { id: "cpf", label: "CPF", sampleText: "074.660.925-60", x: 35.5, y: 173, fontSize: 9.5 },
  { id: "lbl_nascimento", label: "Rótulo: Nascimento", sampleText: "Nascimento:", x: 225, y: 158.5, fontSize: 9.5, bold: true },
  { id: "nascimento", label: "Nascimento", sampleText: "05/08/1997", x: 225, y: 173, fontSize: 9.5 },
  { id: "lbl_emissao", label: "Rótulo: Emissão", sampleText: "Emissão:", x: 386, y: 158.5, fontSize: 9.5, bold: true },
  { id: "emissao", label: "Emissão", sampleText: "30/03/2024 - 17:19:37", x: 386, y: 173, fontSize: 9.5 },
  { id: "lbl_endereco", label: "Rótulo: Endereço", sampleText: "Endereço:", x: 35.5, y: 198.5, fontSize: 9.5, bold: true },
  { id: "endereco", label: "Endereço", sampleText: "- 99102312, -", x: 35.5, y: 213, fontSize: 9.5, w: 470 },
  { id: "qr", label: "QR Code", sampleText: "", x: 530, y: 161, fontSize: 8, w: 88, h: 88 },
  { id: "lbl_token", label: "Rótulo: Token", sampleText: "Token da receita:", x: 631, y: 174, fontSize: 8.3 },
  { id: "token", label: "Token", sampleText: "MHYH4JC", x: 631, y: 188, fontSize: 8.8, bold: true },
  { id: "lbl_codigo", label: "Rótulo: Código de acesso", sampleText: "Código de acesso:", x: 631, y: 211, fontSize: 8.3 },
  { id: "codigo", label: "Código de acesso", sampleText: "9836", x: 631, y: 225, fontSize: 8.8, bold: true },
  { id: "medicamentos", label: "Lista de medicamentos", sampleText: "Budesonida (Spray) 32 mcg/Dose, Suspensão nasal (1un)\nAplicar 1 jato nas narinas 3x ao dia\nHexomedine (Spray) 1 mg/mL + 0.5 mg/mL, Colutório (1un)\nbater em garganta 3x ao dia", x: 35.5, y: 305, fontSize: 11.5, w: 722 },
  { id: "medico", label: "Médico(a) + CRM", sampleText: "Dr(a). Ana Flavia Resende Romanielo  |  CRM 31186 GO", x: 97, y: 1024, fontSize: 10.5, w: 600, bold: true },
  { id: "endereco_clinica", label: "Endereço da clínica", sampleText: "SCS Quadra 03 Bloco A, Numero 107, Sala 103 - Brasília DF - CEP 70303907", x: 47, y: 1049, fontSize: 9.6, w: 700 },
  { id: "telefone", label: "Telefone", sampleText: "Telefone: (61) 3221-5350", x: 47, y: 1061, fontSize: 9.6, w: 700 },
  { id: "farmaceutico", label: "Linha do farmacêutico", sampleText: "Farmacêutico, valide a receita digital em https://farmacias.mevosaude.com.br", x: 47, y: 1075, fontSize: 9, w: 700 },
];

// Defaults MUST match supabase/functions/generate-craf-pdf/index.ts CRAF_DEFAULT_POSITIONS
export const defaultCrafFields: FieldDef[] = [
  { id: "validade", label: "Validade", sampleText: "30/03/2032", x: 212, y: 138, fontSize: 9.5, w: 120 },
  { id: "nome", label: "Nome completo", sampleText: "Bruno Henrique Couto Neves", x: 215, y: 173, fontSize: 9, w: 262 },
  { id: "cpf", label: "CPF", sampleText: "015.063.256-88", x: 215, y: 209, fontSize: 9, w: 95 },
  { id: "rg", label: "RG", sampleText: "MG-10.617.978", x: 313.6, y: 210.5, fontSize: 9, w: 100 },
  { id: "sfpc", label: "SFPC de vinculação (RM)", sampleText: "Cmdo 4ª RM", x: 421.7, y: 210.5, fontSize: 9, w: 130 },
  { id: "amparo", label: "Amparo legal", sampleText: "art. 3º da Lei 10.826/03 e art. 4 do Decreto 9.847/19.", x: 215, y: 243, fontSize: 8.5, w: 350 },
  { id: "registro", label: "Registro", sampleText: "ADT ELET SISFPC NR 72 DE 30/03/2022, 4º GAAAE", x: 403, y: 402, fontSize: 7.5, w: 162 },
  { id: "tipo", label: "Tipo", sampleText: "CARABINA / FUZIL", x: 405.7, y: 432, fontSize: 8, w: 70 },
  { id: "marca", label: "Marca", sampleText: "AMADEO ROSSI", x: 483, y: 432, fontSize: 8.5, w: 82 },
  { id: "calibre", label: "Calibre", sampleText: "357 Magnum", x: 405.7, y: 456, fontSize: 8.5, w: 76 },
  { id: "numero_serie", label: "Nº de série", sampleText: "NVH 4712721", x: 405.7, y: 481.5, fontSize: 8.5, w: 76 },
  { id: "numero_sigma", label: "Nº SIGMA", sampleText: "1817992", x: 483, y: 483, fontSize: 8.5, w: 82 },
  { id: "data_expedicao", label: "Data de expedição", sampleText: "30/03/2022", x: 405.7, y: 505.5, fontSize: 8.5, w: 76 },
  { id: "assinado_por", label: "Linha: assinado por", sampleText: "Documento Assinado Eletrônicamente por:", x: 400.4, y: 536.5, fontSize: 8.5, w: 200 },
  { id: "assinante", label: "Assinante", sampleText: "SFPC - 4º GAAAe", x: 400.4, y: 551, fontSize: 8.5, w: 200 },
  { id: "cidade_data", label: "Cidade e data", sampleText: "Sete Lagoas/MG, 30/03/2022", x: 400.4, y: 564.5, fontSize: 8.5, w: 200 },
  { id: "qr", label: "QR Code", sampleText: "", x: 225.8, y: 411, fontSize: 8, w: 137, h: 137 },
  { id: "qr_label", label: "Rótulo do QR", sampleText: "QR Code Vio", x: 258, y: 578, fontSize: 8.5, w: 120 },
  { id: "autenticidade", label: "Código de autenticidade", sampleText: "A Autenticidade no SisGCorp eb559a07035876bc154520d8e8b23e33", x: 258, y: 590.5, fontSize: 8.5, w: 260 },
];

// Defaults MUST match supabase/functions/generate-unip-pdf/index.ts UNIP_DEFAULT_POSITIONS
export const defaultUnipFields: FieldDef[] = [
  { id: "inst_titulo", label: "Instituição (título)", sampleText: "Universidade Paulista", x: 644, y: 168, fontSize: 62 },
  { id: "corpo", label: "Texto do diploma", sampleText: "O Reitor da Universidade Paulista confere o título de", x: 644, y: 279, fontSize: 17 },
  { id: "titulo_conferido", label: "Título conferido", sampleText: "BACHAREL EM ADMINISTRAÇÃO", x: 644, y: 374, fontSize: 25 },
  { id: "aluno", label: "Nome do aluno", sampleText: "MARIA OLIVEIRA SANTOS", x: 644, y: 426, fontSize: 32 },
  { id: "dados_pessoais", label: "Dados pessoais", sampleText: "brasileira, natural de SÃO PAULO - SP, nascida em 11/03/1989", x: 644, y: 493, fontSize: 17 },
  { id: "outorga", label: "Outorga", sampleText: "e outorga-lhe o presente diploma", x: 644, y: 560, fontSize: 17 },
  { id: "cidade_data", label: "Cidade e data", sampleText: "São Paulo, 14 de março de 2026", x: 644, y: 633, fontSize: 17 },
  { id: "reitor_nome", label: "Reitor (nome)", sampleText: "JOÃO CARLOS DI GENIO", x: 644, y: 746, fontSize: 15 },
  { id: "reitor_cargo", label: "Reitor (cargo)", sampleText: "Reitor", x: 644, y: 768, fontSize: 15 },
  { id: "val_bloco", label: "Bloco de validação", sampleText: "Código: UNIP-2026-000123", x: 915, y: 761, fontSize: 10 },
  { id: "p2_ra", label: "V. RA", sampleText: "F123456", x: 757, y: 984, fontSize: 12.5 },
  { id: "p2_lote", label: "V. Lote", sampleText: "LOTE 231", x: 1008, y: 984, fontSize: 12.5 },
  { id: "p2_esq_mantenedora", label: "V. Mantenedora (esq.)", sampleText: "ASSOCIAÇÃO UNIFICADA PAULISTA", x: 368, y: 1017, fontSize: 12.5 },
  { id: "p2_esq_ies", label: "V. IES (esq.)", sampleText: "UNIVERSIDADE PAULISTA", x: 368, y: 1093, fontSize: 12.5 },
  { id: "p2_esq_recred", label: "V. Recredenciamento (esq.)", sampleText: "Recredenciamento: Portaria nº 000", x: 368, y: 1144, fontSize: 12.5 },
  { id: "p2_esq_curso", label: "V. Curso (esq.)", sampleText: "Curso de ADMINISTRAÇÃO", x: 368, y: 1223, fontSize: 12.5 },
  { id: "p2_esq_emec", label: "V. e-MEC (esq.)", sampleText: "Código e-MEC: 12345", x: 368, y: 1259, fontSize: 12.5 },
  { id: "p2_esq_reconhecimento", label: "V. Reconhecimento (esq.)", sampleText: "Reconhecimento: Portaria nº 000", x: 368, y: 1309, fontSize: 12.5 },
  { id: "p2_dir_mantenedora", label: "V. Mantenedora (dir.)", sampleText: "ASSOCIAÇÃO UNIFICADA PAULISTA", x: 987, y: 1017, fontSize: 12.5 },
  { id: "p2_dir_ies", label: "V. IES (dir.)", sampleText: "UNIVERSIDADE PAULISTA", x: 987, y: 1060, fontSize: 14.5 },
  { id: "p2_dir_recred", label: "V. Recredenciamento (dir.)", sampleText: "Recredenciamento: Portaria nº 000", x: 987, y: 1093, fontSize: 12.5 },
  { id: "p2_dir_secretaria", label: "V. Secretaria", sampleText: "SECRETARIA GERAL", x: 987, y: 1175, fontSize: 12.5 },
  { id: "p2_dir_registro", label: "V. Registro", sampleText: "Registrado sob o nº 0000, Livro 1, fls 000", x: 757, y: 1244, fontSize: 12.5 },
  { id: "p2_dir_processo", label: "V. Processo", sampleText: "Processo nº SRD/000/2026", x: 757, y: 1352, fontSize: 12.5 },
  { id: "p2_dir_cidade_data", label: "V. Cidade e data", sampleText: "São Paulo - SP, 14/03/2026", x: 882, y: 1388, fontSize: 12.5 },
  { id: "p2_dir_assinatura", label: "V. Assinatura", sampleText: "ADRIANA SILVA ARAUJO", x: 757, y: 1506, fontSize: 12 },
  { id: "qr", label: "QR Code (validação)", sampleText: "[QR]", x: 1063, y: 1596, fontSize: 8, w: 139, h: 139, color: "#999" },
];

// Defaults MUST match supabase/functions/generate-anhanguera-pdf/index.ts ANHANGUERA_DEFAULT_POSITIONS
export const defaultAnhangueraFields: FieldDef[] = [
  { id: "inst_titulo", label: "Instituição (título)", sampleText: "UNIVERSIDADE ANHANGUERA", x: 644, y: 243, fontSize: 28 },
  { id: "corpo", label: "Texto do diploma", sampleText: "O Reitor da Universidade Anhanguera confere o título de", x: 644, y: 339, fontSize: 15.5 },
  { id: "titulo_conferido", label: "Título conferido", sampleText: "BACHAREL EM ADMINISTRAÇÃO", x: 644, y: 448, fontSize: 21 },
  { id: "aluno", label: "Nome do aluno", sampleText: "MARIA OLIVEIRA SANTOS", x: 644, y: 494, fontSize: 28 },
  { id: "dados_pessoais", label: "Dados pessoais", sampleText: "brasileira, natural de SÃO PAULO - SP, nascida em 11/03/1989", x: 644, y: 541, fontSize: 15.5 },
  { id: "cidade_data", label: "Cidade e data", sampleText: "São Paulo, 14 de março de 2026", x: 644, y: 652, fontSize: 15.5 },
  { id: "assinante_nome", label: "Assinante (nome)", sampleText: "CARLOS EDUARDO LIMA", x: 644, y: 802, fontSize: 15 },
  { id: "assinante_cargo", label: "Assinante (cargo)", sampleText: "Reitor", x: 644, y: 823, fontSize: 15 },
  { id: "val_bloco", label: "Bloco de validação", sampleText: "Código: ANH-2026-000123", x: 1243, y: 868, fontSize: 14 },
  { id: "p2_curso", label: "V. Curso", sampleText: "Curso de ADMINISTRAÇÃO", x: 160, y: 1026, fontSize: 12.5 },
  { id: "p2_reconhecimento", label: "V. Reconhecimento", sampleText: "Reconhecimento: Portaria nº 000", x: 160, y: 1057, fontSize: 12.5 },
  { id: "p2_ies", label: "V. IES", sampleText: "UNIVERSIDADE ANHANGUERA", x: 160, y: 1104, fontSize: 12.5 },
  { id: "p2_recred_ies", label: "V. Recredenciamento IES", sampleText: "Recredenciamento: Portaria nº 000", x: 160, y: 1168, fontSize: 12.5 },
  { id: "p2_uniderp", label: "V. Uniderp", sampleText: "UNIDERP", x: 160, y: 1198, fontSize: 12.5 },
  { id: "p2_recred_uniderp", label: "V. Recredenciamento Uniderp", sampleText: "Recredenciamento: Portaria nº 000", x: 160, y: 1262, fontSize: 12.5 },
  { id: "p2_registro", label: "V. Registro", sampleText: "Registrado sob o nº 0000, Livro 1, fls 000", x: 160, y: 1293, fontSize: 12.5 },
  { id: "p2_cidade_data", label: "V. Cidade e data", sampleText: "Campo Grande - MS, 14/03/2026", x: 160, y: 1356, fontSize: 12.5 },
  { id: "p2_assinatura", label: "V. Assinatura", sampleText: "ADRIANA SILVA ARAUJO", x: 160, y: 1387, fontSize: 12.5 },
  { id: "qr", label: "QR Code (validação)", sampleText: "[QR]", x: 1064, y: 1732, fontSize: 8, w: 78, h: 78, color: "#999" },
];

type DocKey = "cnh" | "rg" | "atestado" | "hapvida" | "unimed" | "crlv" | "cha" | "diploma" | "historico" | "certidao" | "declaracao" | "receita" | "craf" | "unip" | "anhanguera";


interface EditorConfig {
  key: DocKey;
  title: string;
  storageKey: string;
  defaults: FieldDef[];
  bg: string;
  /** páginas extras empilhadas verticalmente (ex.: diploma) */
  bgs?: string[];
  pageW?: number;
  pageH?: number;
  font: string;
  mrzFont: string;
  mrzWidth: number;
  estadoBoxW: number;
  estadoMaxChars: number;
  mrzLineHeight: number;
  copy: () => Record<string, unknown>;
}

const EDITORS: Record<DocKey, EditorConfig> = {
  cnh: {
    key: "cnh",
    title: "CNH Digital",
    storageKey: CNH_ALIGN_STORAGE_KEY,
    defaults: defaultCnhFields,
    bg: templateBgUrl,
    font: CNH_FONT,
    mrzFont: CNH_FONT,
    mrzWidth: 378,
    estadoBoxW: 170,
    estadoMaxChars: 9,
    mrzLineHeight: 1.6,
    copy: () => loadCnhFieldPositions() ?? {},
  },
  rg: {
    key: "rg",
    title: "RG Digital",
    storageKey: RG_ALIGN_STORAGE_KEY,
    defaults: defaultRgFields,
    bg: templateRgBgUrl,
    font: RG_FONT,
    mrzFont: RG_MRZ_FONT,
    mrzWidth: 420,
    estadoBoxW: 220,
    estadoMaxChars: 12,
    mrzLineHeight: 1.22,
    copy: () => loadRgFieldPositions() ?? {},
  },
  atestado: {
    key: "atestado",
    title: "Atestado UPA24h",
    storageKey: ATESTADO_ALIGN_STORAGE_KEY,
    defaults: defaultAtestadoFields,
    bg: templateAtestadoBgUrl,
    font: ATESTADO_FONT,
    mrzFont: ATESTADO_FONT,
    mrzWidth: 400,
    estadoBoxW: 240,
    estadoMaxChars: 40,
    mrzLineHeight: 1.32,
    copy: () => loadAtestadoFieldPositions() ?? {},
  },
  hapvida: {
    key: "hapvida",
    title: "Atestado HapVida",
    storageKey: HAPVIDA_ALIGN_STORAGE_KEY,
    defaults: defaultHapvidaFields,
    bg: templateHapvidaBgUrl,
    font: HAPVIDA_FONT,
    mrzFont: HAPVIDA_FONT,
    mrzWidth: 400,
    estadoBoxW: 240,
    estadoMaxChars: 40,
    mrzLineHeight: 1.32,
    copy: () => loadHapvidaFieldPositions() ?? {},
  },
  unimed: {
    key: "unimed",
    title: "Atestado Unimed",
    storageKey: UNIMED_ALIGN_STORAGE_KEY,
    defaults: defaultUnimedFields,
    bg: templateUnimedBgUrl,
    font: UNIMED_FONT,
    mrzFont: UNIMED_FONT,
    mrzWidth: 400,
    estadoBoxW: 240,
    estadoMaxChars: 40,
    mrzLineHeight: 1.22,
    copy: () => loadUnimedFieldPositions() ?? {},
  },
  crlv: {
    key: "crlv",
    title: "CRLV Digital",
    storageKey: CRLV_ALIGN_STORAGE_KEY,
    defaults: defaultCrlvFields,
    bg: templateCrlvBgUrl,
    font: CRLV_FONT,
    mrzFont: CRLV_FONT,
    mrzWidth: 400,
    estadoBoxW: 240,
    estadoMaxChars: 40,
    mrzLineHeight: 1.2,
    copy: () => loadCrlvFieldPositions() ?? {},
  },
  cha: {
    key: "cha",
    title: "CNH Marítima",
    storageKey: CHA_ALIGN_STORAGE_KEY,
    defaults: defaultChaFields,
    bg: templateChaBgUrl,
    font: CHA_FONT,
    mrzFont: CHA_FONT,
    mrzWidth: 400,
    estadoBoxW: 240,
    estadoMaxChars: 40,
    mrzLineHeight: 1.2,
    copy: () => loadChaFieldPositions() ?? {},
  },
  diploma: {
    key: "diploma",
    title: "Diploma",
    storageKey: DIPLOMA_ALIGN_STORAGE_KEY,
    defaults: defaultDiplomaFields,
    bg: templateDiplomaP1Url,
    bgs: [templateDiplomaP1Url, templateDiplomaP2Url],
    pageW: 1288,
    pageH: 1732,
    font: DIPLOMA_FONT,
    mrzFont: DIPLOMA_FONT,
    mrzWidth: 400,
    estadoBoxW: 240,
    estadoMaxChars: 40,
    mrzLineHeight: 1.2,
    copy: () => loadDiplomaFieldPositions() ?? {},
  },
  historico: {
    key: "historico",
    title: "Histórico + Certificado",
    storageKey: HISTORICO_ALIGN_STORAGE_KEY,
    defaults: defaultHistoricoFields,
    bg: templateHistoricoBgUrl,
    font: HISTORICO_FONT,
    mrzFont: HISTORICO_FONT,
    mrzWidth: 400,
    estadoBoxW: 240,
    estadoMaxChars: 40,
    mrzLineHeight: 1.22,
    copy: () => loadHistoricoFieldPositions() ?? {},
  },
  certidao: {
    key: "certidao",
    title: "Certidão de Nascimento",
    storageKey: CERTIDAO_ALIGN_STORAGE_KEY,
    defaults: defaultCertidaoFields,
    bg: templateCertidaoBgUrl,
    font: CERTIDAO_FONT,
    mrzFont: CERTIDAO_FONT,
    mrzWidth: 400,
    estadoBoxW: 240,
    estadoMaxChars: 40,
    mrzLineHeight: 1.42,
    copy: () => loadCertidaoFieldPositions() ?? {},
  },
  declaracao: {
    key: "declaracao",
    title: "Declaração Escolar",
    storageKey: DECLARACAO_ALIGN_STORAGE_KEY,
    defaults: defaultDeclaracaoFields,
    bg: templateDeclaracaoBgUrl,
    font: DECLARACAO_FONT,
    mrzFont: DECLARACAO_FONT,
    mrzWidth: 400,
    estadoBoxW: 240,
    estadoMaxChars: 40,
    mrzLineHeight: 1.72,
    copy: () => loadDeclaracaoFieldPositions() ?? {},
  },
  receita: {
    key: "receita",
    title: "Receita Médica",
    storageKey: RECEITA_ALIGN_STORAGE_KEY,
    defaults: defaultReceitaFields,
    bg: templateReceitaBgUrl,
    font: RECEITA_FONT,
    mrzFont: RECEITA_FONT,
    mrzWidth: 400,
    estadoBoxW: 240,
    estadoMaxChars: 40,
    mrzLineHeight: 1.22,
    copy: () => loadReceitaFieldPositions() ?? {},
  },
  craf: {
    key: "craf",
    title: "CRAF",
    storageKey: CRAF_ALIGN_STORAGE_KEY,
    defaults: defaultCrafFields,
    bg: templateCrafBgUrl,
    font: CRAF_FONT,
    mrzFont: CRAF_FONT,
    mrzWidth: 400,
    estadoBoxW: 240,
    estadoMaxChars: 40,
    mrzLineHeight: 1.2,
    copy: () => loadCrafFieldPositions() ?? {},
  },
  unip: {
    key: "unip",
    title: "Diploma UNIP",
    storageKey: UNIP_ALIGN_STORAGE_KEY,
    defaults: defaultUnipFields,
    bg: templateUnipP1Url,
    bgs: [templateUnipP1Url, templateUnipP2Url],
    pageW: 1288,
    pageH: 1822,
    font: UNIP_FONT,
    mrzFont: UNIP_FONT,
    mrzWidth: 400,
    estadoBoxW: 240,
    estadoMaxChars: 40,
    mrzLineHeight: 1.2,
    copy: () => loadUnipFieldPositions() ?? {},
  },
  anhanguera: {
    key: "anhanguera",
    title: "Diploma Anhanguera",
    storageKey: ANHANGUERA_ALIGN_STORAGE_KEY,
    defaults: defaultAnhangueraFields,
    bg: templateAnhangueraP1Url,
    bgs: [templateAnhangueraP1Url, templateAnhangueraP2Url],
    pageW: 1288,
    pageH: 1938,
    font: ANHANGUERA_FONT,
    mrzFont: ANHANGUERA_FONT,
    mrzWidth: 400,
    estadoBoxW: 240,
    estadoMaxChars: 40,
    mrzLineHeight: 1.2,
    copy: () => loadAnhangueraFieldPositions() ?? {},
  },
};





function FieldPropertiesPanel({ field, onUpdate }: { field: FieldDef; onUpdate: (updates: Partial<FieldDef>) => void }) {
  const isQr = /^qr\d*$/.test(field.id);
  const isBox = field.id === "photo" || field.id === "signature" || field.id === "brasao" || isQr;

  // Redimensiona o QR mantendo a proporção. Se "grow" for para cima/esquerda,
  // compensamos x/y para que a âncora fique no canto inferior direito.
  const resizeQr = (size: number, anchor: "tl" | "br") => {
    const next = Math.max(30, Math.min(900, Math.round(size)));
    const curW = field.w || 100;
    const curH = field.h || 100;
    if (anchor === "br") {
      const dx = next - curW;
      const dy = next - curH;
      onUpdate({ w: next, h: next, x: Math.max(0, field.x - dx), y: Math.max(0, field.y - dy) });
    } else {
      onUpdate({ w: next, h: next });
    }
  };


  return (
    <div className="glass rounded-lg p-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-primary font-display">{field.label}</span>
        <span className="text-muted-foreground font-mono text-xs">
          x:{field.x} y:{field.y}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">X</Label>
          <Input
            type="number"
            value={field.x}
            onChange={(e) => onUpdate({ x: Math.max(0, Number(e.target.value)) })}
            className="h-7 text-xs font-mono bg-secondary/50"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Y</Label>
          <Input
            type="number"
            value={field.y}
            onChange={(e) => onUpdate({ y: Math.max(0, Number(e.target.value)) })}
            className="h-7 text-xs font-mono bg-secondary/50"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Tamanho da fonte</Label>
        <div className="flex items-center gap-2 mt-1">
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onUpdate({ fontSize: Math.max(4, field.fontSize - 0.5) })}>
            <Minus className="w-3 h-3" />
          </Button>
          <Input
            type="number"
            step="0.5"
            min="4"
            max="40"
            value={field.fontSize}
            onChange={(e) => onUpdate({ fontSize: Math.max(4, Number(e.target.value)) })}
            className="h-7 text-xs font-mono text-center bg-secondary/50 w-16"
          />
          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onUpdate({ fontSize: Math.min(40, field.fontSize + 0.5) })}>
            <Plus className="w-3 h-3" />
          </Button>
          <Slider value={[field.fontSize]} min={4} max={40} step={0.5} onValueChange={([v]) => onUpdate({ fontSize: v })} className="flex-1" />
        </div>
      </div>

      {isBox && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">Largura</Label>
            <Input
              type="number"
              value={field.w || 80}
              onChange={(e) => onUpdate({ w: Math.max(10, Number(e.target.value)) })}
              className="h-7 text-xs font-mono bg-secondary/50"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Altura</Label>
            <Input
              type="number"
              value={field.h || 80}
              onChange={(e) => onUpdate({ h: Math.max(10, Number(e.target.value)) })}
              className="h-7 text-xs font-mono bg-secondary/50"
            />
          </div>
        </div>
      )}

      {field.rotate !== undefined && (
        <div>
          <Label className="text-xs text-muted-foreground">Rotação (graus)</Label>
          <Input
            type="number"
            value={field.rotate}
            onChange={(e) => onUpdate({ rotate: Number(e.target.value) })}
            className="h-7 text-xs font-mono bg-secondary/50"
          />
        </div>
      )}
    </div>
  );
}

/** Espelha STYLES de supabase/functions/generate-diploma-pdf/index.ts */
const DIPLOMA_STYLES: Record<string, { center?: boolean; width?: number; lineHeight?: number; mask?: { w: number; h: number }; italic?: boolean }> = {
  rep_federativa: { center: true, width: 700 },
  ministerio: { center: true, width: 700 },
  inst_l1: { center: true, width: 1000 },
  inst_l2: { center: true, width: 1000 },
  corpo: { center: true, width: 1030, lineHeight: 37.7 },
  cidade_data: { width: 440, lineHeight: 20 },
  reitor: { center: true, mask: { w: 320, h: 17 }, italic: true },
  rodape_inst: { center: true, width: 700 },
  rodape_validacao: { center: true, width: 900 },
  p2_esq_nome: { width: 620, lineHeight: 17 },
  p2_esq_razao: { width: 620, lineHeight: 17 },
  p2_esq_cred: { width: 600, lineHeight: 17 },
  p2_esq_recred: { width: 600, lineHeight: 17 },
  p2_curso: { width: 620, lineHeight: 17 },
  p2_reconhecimento: { width: 600, lineHeight: 17 },
  p2_renovacao: { width: 600, lineHeight: 17 },
  p2_dir_recred: { width: 580, lineHeight: 17 },
  p2_registro: { width: 580, lineHeight: 17 },
  p2_processo: { width: 580, lineHeight: 17 },
  p2_cidade_data: { width: 580, lineHeight: 17 },
  secretario: { center: true, mask: { w: 320, h: 17 }, italic: true },
  resolucao: { center: true, mask: { w: 260, h: 16 }, italic: true },
};

function diplomaStyle(f: FieldDef, PW: number, scale: number): React.CSSProperties {
  const st = DIPLOMA_STYLES[f.id];
  if (!st) return {};
  const s: React.CSSProperties = { whiteSpace: "pre-line" };
  if (st.mask) {
    s.width = `${((st.mask.w / PW) * 100).toFixed(4)}%`;
    s.display = "flex";
    s.alignItems = "center";
    s.justifyContent = "center";
  } else if (st.width) {
    s.width = `${((st.width / PW) * 100).toFixed(4)}%`;
  }
  if (st.center) {
    s.transform = "translateX(-50%)";
    s.textAlign = "center";
  }
  if (st.italic) s.fontStyle = "italic";
  if (st.lineHeight) s.lineHeight = `${st.lineHeight * scale}px`;
  return s;
}

function AlignEditor({ cfg }: { cfg: EditorConfig }) {
  const [fields, setFields] = useState<FieldDef[]>(() => {
    const saved = localStorage.getItem(cfg.storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // merge to keep new metadata (labels/colors) while using saved geometry
          return cfg.defaults.map((def) => {
            const s = parsed.find((p: FieldDef) => p.id === def.id);
            return s ? { ...def, x: s.x, y: s.y, fontSize: s.fontSize, w: s.w ?? def.w, h: s.h ?? def.h, rotate: s.rotate ?? def.rotate } : def;
          });
        }
      } catch {
        /* ignore */
      }
    }
    return cfg.defaults;
  });

  const PW = cfg.pageW ?? PAGE_W;
  const PH = cfg.pageH ?? PAGE_H;

  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) setScale(containerRef.current.clientWidth / PW);
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [PW]);

  // Auto-persist so the PDF always uses the latest alignment (real-time)
  useEffect(() => {
    localStorage.setItem(cfg.storageKey, JSON.stringify(fields));
    window.dispatchEvent(new CustomEvent(`${cfg.key}-align-updated`));
  }, [fields, cfg.storageKey, cfg.key]);

  // Troca de documento: recarrega os campos do editor selecionado
  useEffect(() => {
    setSelected(null);
    const saved = localStorage.getItem(cfg.storageKey);
    if (!saved) {
      setFields(cfg.defaults);
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return;
      setFields(
        cfg.defaults.map((def) => {
          const s = parsed.find((p: FieldDef) => p.id === def.id);
          return s ? { ...def, x: s.x, y: s.y, fontSize: s.fontSize, w: s.w ?? def.w, h: s.h ?? def.h, rotate: s.rotate ?? def.rotate } : def;
        }),
      );
    } catch {
      setFields(cfg.defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.key]);


  const updateField = useCallback((id: string, updates: Partial<FieldDef>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const startDrag = useCallback(
    (clientX: number, clientY: number, fieldId: string) => {
      setSelected(fieldId);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const field = fields.find((f) => f.id === fieldId);
      if (!field) return;
      setDragging({
        id: fieldId,
        offsetX: (clientX - rect.left) / scale - field.x,
        offsetY: (clientY - rect.top) / scale - field.y,
      });
    },
    [fields, scale]
  );

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.round((clientX - rect.left) / scale - dragging.offsetX);
      const y = Math.round((clientY - rect.top) / scale - dragging.offsetY);
      setFields((prev) =>
        prev.map((f) => (f.id === dragging.id ? { ...f, x: Math.max(0, Math.min(PW, x)), y: Math.max(0, Math.min(PH, y)) } : f))
      );
    };
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onEnd = () => setDragging(null);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [dragging, scale]);

  useEffect(() => {
    if (!selected) return;
    const handleKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 5 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      if (e.key === "ArrowRight") dx = step;
      if (e.key === "ArrowUp") dy = -step;
      if (e.key === "ArrowDown") dy = step;
      if (dx === 0 && dy === 0) return;
      e.preventDefault();
      setFields((prev) =>
        prev.map((f) => (f.id === selected ? { ...f, x: Math.max(0, Math.min(PW, f.x + dx)), y: Math.max(0, Math.min(PH, f.y + dy)) } : f))
      );
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selected]);

  const [saving, setSaving] = useState(false);

  // Carrega o alinhamento oficial (banco) ao abrir o editor
  useEffect(() => {
    void syncAlignmentsFromDb().then(() => {
      const saved = localStorage.getItem(cfg.storageKey);
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return;
        setFields(
          cfg.defaults.map((def) => {
            const s = parsed.find((p: FieldDef) => p.id === def.id);
            return s ? { ...def, x: s.x, y: s.y, fontSize: s.fontSize, w: s.w ?? def.w, h: s.h ?? def.h, rotate: s.rotate ?? def.rotate } : def;
          }),
        );
      } catch {
        /* ignore */
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.key]);

  const savePositions = async () => {
    setSaving(true);
    try {
      await saveAlignmentToDb(cfg.key, fields);
      toast({ title: "Coordenadas salvas!", description: `Salvo de forma definitiva — o preview e o PDF do ${cfg.title} vão usar exatamente estas posições.` });
    } catch (e) {
      localStorage.setItem(cfg.storageKey, JSON.stringify(fields));
      toast({
        variant: "destructive",
        title: "Salvo apenas neste dispositivo",
        description: "Não foi possível salvar no servidor (apenas administradores podem salvar globalmente).",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetPositions = () => {
    setFields(cfg.defaults);
    setSelected(null);
    toast({ title: "Posições resetadas!" });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(JSON.stringify(cfg.copy(), null, 2));
    toast({ title: "Coordenadas copiadas!" });
  };

  const selectedField = fields.find((f) => f.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-foreground font-display">Alinhamento - {cfg.title}</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={resetPositions} className="gap-1.5">
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
          <Button size="sm" variant="outline" onClick={copyCode} className="gap-1.5">
            <Copy className="w-4 h-4" /> Copiar Coords
          </Button>
          <Button size="sm" onClick={savePositions} disabled={saving} className="gap-1.5">
            <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar coordenadas"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Arraste os campos para posicioná-los. Use as setas do teclado (Shift = 5px). As alterações são aplicadas na geração do PDF em tempo real.
      </p>

      {selectedField && <FieldPropertiesPanel field={selectedField} onUpdate={(u) => updateField(selectedField.id, u)} />}

      <div className="overflow-auto border border-border rounded-xl bg-white">
        <div
          ref={containerRef}
          className="relative select-none w-full"
          style={{ aspectRatio: `${PW} / ${PH}`, maxWidth: PW }}
          onClick={() => setSelected(null)}
        >
          {(cfg.bgs ?? [cfg.bg]).map((src, i, arr) => (
            <img
              key={i}
              src={src}
              alt={`Template ${cfg.title} ${i + 1}`}
              className="absolute left-0 w-full"
              style={{ top: `${(i / arr.length) * 100}%`, height: `${100 / arr.length}%`, objectFit: "fill" }}
              draggable={false}
            />
          ))}

          {fields.map((f) => {
            const isSelected = f.id === selected;
            const isBox = !!f.w && !!f.h;
            const isEstado = f.id === "estado";
            const isMrz = f.id === "mrz";
            const isCorpo = cfg.key === "atestado" && (f.id === "corpo" || f.id === "cid");
            const isLiberado = cfg.key === "atestado" && f.id === "liberado";
            const estadoSize = isEstado
              ? f.sampleText.length > cfg.estadoMaxChars
                ? Math.max(f.fontSize * (cfg.estadoMaxChars / f.sampleText.length), f.fontSize * 0.55)
                : f.fontSize
              : f.fontSize;

            return (
              <div
                key={f.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  startDrag(e.clientX, e.clientY, f.id);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  startDrag(e.touches[0].clientX, e.touches[0].clientY, f.id);
                }}
                className="absolute cursor-move touch-none"
                style={{
                  top: `${(f.y / PH) * 100}%`,
                  left: `${(f.x / PW) * 100}%`,
                  fontSize: `${estadoSize * scale}px`,
                  fontWeight: f.bold ? "bold" : "normal",
                  fontFamily: isCorpo
                    ? "'Times New Roman', 'Liberation Serif', Times, serif"
                    : cfg.key === "atestado" && !f.id.startsWith("endereco")
                      ? "Arial, 'Liberation Sans', Helvetica, sans-serif"
                      : isMrz
                        ? cfg.mrzFont
                        : cfg.font,
                  color: f.color || "#111",
                  whiteSpace: isEstado ? "nowrap" : "pre-line",
                  outline: isSelected ? "2px solid hsl(var(--primary))" : "1px dashed rgba(0,0,0,0.15)",
                  background: isSelected ? "hsl(var(--primary) / 0.1)" : "transparent",
                  zIndex: isSelected ? 50 : 10,
                  transform: [
                    isEstado ? "translateX(-50%)" : "",
                    f.rotate ? `rotate(${f.rotate}deg)` : "",
                  ].filter(Boolean).join(" ") || undefined,
                  transformOrigin: f.rotate ? "left top" : undefined,
                  ...(isMrz ? { width: `${((cfg.mrzWidth / PW) * 100).toFixed(4)}%` } : {}),
                  lineHeight: isMrz ? cfg.mrzLineHeight : isCorpo ? 1.103 : isLiberado ? 1.15 : 1,
                  ...(f.id === "corpo" && cfg.key === "atestado"
                    ? { width: `${((766 / PW) * 100).toFixed(4)}%`, whiteSpace: "normal" as const, textAlign: "left" as const }
                    : {}),
                  ...(isLiberado
                    ? { width: `${((232 / PW) * 100).toFixed(4)}%`, textAlign: "center" as const }
                    : {}),
                  ...(isEstado ? { width: `${((cfg.estadoBoxW / PW) * 100).toFixed(4)}%`, textAlign: "center" as const } : {}),
                  ...(cfg.key === "hapvida" && f.w && !f.h
                    ? {
                        width: `${((f.w / PW) * 100).toFixed(4)}%`,
                        whiteSpace: "pre-line" as const,
                        lineHeight: f.id === "corpo" ? 1.72 : 1.2,
                        textAlign: (["endereco1", "endereco2", "consulte", "link"].includes(f.id)
                          ? "right"
                          : "left") as "right" | "left",
                      }
                    : {}),
                  ...((cfg.key === "unimed" || cfg.key === "historico") && f.w && !f.h
                    ? {
                        width: `${((f.w / PW) * 100).toFixed(4)}%`,
                        whiteSpace: (cfg.key === "historico" && f.id !== "certificado" && f.id !== "ef_estab" && f.id !== "e1_estab" && f.id !== "e2_estab" && f.id !== "e3_estab"
                          ? "nowrap"
                          : "normal") as "nowrap" | "normal",
                        lineHeight: cfg.key === "historico" && f.id === "certificado" ? 1.28 : 1.22,
                        textAlign: (cfg.key === "historico" && f.id === "certificado" ? "justify" : "left") as "justify" | "left",
                      }
                    : {}),
                  ...(cfg.key === "certidao" && f.w && !f.h
                    ? {
                        width: `${((f.w / PW) * 100).toFixed(4)}%`,
                        whiteSpace: "pre-line" as const,
                        lineHeight: f.id === "cartorio" ? 1.62 : 1.42,
                        textAlign: (["nome", "matricula", "dia", "mes", "ano", "sexo", "lavrada", "dou_fe", "emitida", "mp_texto", "cartorio"].includes(f.id)
                          ? "center"
                          : "left") as "center" | "left",
                      }
                    : {}),
                  ...(cfg.key === "receita" && f.w && !f.h
                    ? {
                        width: `${((f.w / PW) * 100).toFixed(4)}%`,
                        whiteSpace: "pre-line" as const,
                        lineHeight: f.id === "medicamentos" ? 1.5 : 1.2,
                        textAlign: (["unidade_cidade", "medico", "endereco_clinica", "telefone", "farmaceutico"].includes(f.id)
                          ? "center"
                          : "left") as "center" | "left",
                      }
                    : {}),
                  ...(cfg.key === "diploma" ? diplomaStyle(f, PW, scale) : {}),
                  ...(isBox
                    ? {
                        width: `${(((f.w || 80) / PW) * 100).toFixed(4)}%`,
                        height: `${(((f.h || 80) / PH) * 100).toFixed(4)}%`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isSelected ? "hsl(var(--primary) / 0.15)" : "rgba(200,200,200,0.3)",
                      }
                    : {}),
                }}
                title={`${f.label}: x=${f.x}, y=${f.y}, font=${f.fontSize}`}
              >
                {isBox ? (
                  <span style={{ fontSize: `${10 * scale}px`, color: "#666" }}>{f.label}</span>
                ) : isMrz ? (
                  f.sampleText.split("\n").map((line, i) => (
                    <div key={i} style={{ textAlign: "left", whiteSpace: "pre" }}>
                      {line}
                    </div>
                  ))
                ) : (
                  f.sampleText
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TemplateAlignPage() {
  const [doc, setDoc] = useState<DocKey>("cnh");

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold text-foreground font-display">Editor de Alinhamento</h1>

      <div className="inline-flex flex-wrap rounded-xl border border-border bg-secondary/40 p-1">
        {(["cnh", "rg", "atestado", "hapvida", "unimed", "crlv", "cha", "diploma", "unip", "anhanguera", "historico", "certidao", "declaracao", "receita", "craf"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setDoc(k)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              doc === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {EDITORS[k].title}
          </button>
        ))}
      </div>

      <AlignEditor key={doc} cfg={EDITORS[doc]} />
    </div>
  );
}

