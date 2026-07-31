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
import { CNH_ALIGN_STORAGE_KEY, loadCnhFieldPositions } from "@/lib/cnh-align";
import { RG_ALIGN_STORAGE_KEY, loadRgFieldPositions } from "@/lib/rg-align";
import { ATESTADO_ALIGN_STORAGE_KEY, loadAtestadoFieldPositions } from "@/lib/atestado-align";
import { CRLV_ALIGN_STORAGE_KEY, loadCrlvFieldPositions } from "@/lib/crlv-align";
import { CHA_ALIGN_STORAGE_KEY, loadChaFieldPositions } from "@/lib/cha-align";
import { saveAlignmentToDb, syncAlignmentsFromDb } from "@/lib/align-sync";

const PAGE_W = 794;
const PAGE_H = 1123;

const CNH_FONT = "'CNHDigital', Arial, Helvetica, sans-serif";
const RG_FONT = "'RGDigital', Arial, Helvetica, sans-serif";
const RG_MRZ_FONT = "'RGOcrb', 'Courier New', monospace";
const ATESTADO_FONT = "Calibri, Carlito, 'Segoe UI', Arial, Helvetica, sans-serif";
const CRLV_FONT = "'FreeMono', 'Liberation Mono', 'Courier New', monospace";
const CHA_FONT = "Arial, 'Liberation Sans', Helvetica, sans-serif";



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

type DocKey = "cnh" | "rg" | "atestado" | "crlv";


interface EditorConfig {
  key: DocKey;
  title: string;
  storageKey: string;
  defaults: FieldDef[];
  bg: string;
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
    title: "Atestado Médico",
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

};




function FieldPropertiesPanel({ field, onUpdate }: { field: FieldDef; onUpdate: (updates: Partial<FieldDef>) => void }) {
  const isBox = field.id === "photo" || field.id === "signature";

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


  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) setScale(containerRef.current.clientWidth / PAGE_W);
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

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
        prev.map((f) => (f.id === dragging.id ? { ...f, x: Math.max(0, Math.min(PAGE_W, x)), y: Math.max(0, Math.min(PAGE_H, y)) } : f))
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
        prev.map((f) => (f.id === selected ? { ...f, x: Math.max(0, Math.min(PAGE_W, f.x + dx)), y: Math.max(0, Math.min(PAGE_H, f.y + dy)) } : f))
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
          style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}`, maxWidth: PAGE_W }}
          onClick={() => setSelected(null)}
        >
          <img src={cfg.bg} alt={`Template ${cfg.title}`} className="absolute inset-0 w-full h-full" style={{ objectFit: "fill" }} draggable={false} />

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
                  top: `${(f.y / PAGE_H) * 100}%`,
                  left: `${(f.x / PAGE_W) * 100}%`,
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
                  ...(isMrz ? { width: `${((cfg.mrzWidth / PAGE_W) * 100).toFixed(4)}%` } : {}),
                  lineHeight: isMrz ? cfg.mrzLineHeight : isCorpo ? 1.103 : isLiberado ? 1.15 : 1,
                  ...(f.id === "corpo" && cfg.key === "atestado"
                    ? { width: `${((766 / PAGE_W) * 100).toFixed(4)}%`, whiteSpace: "normal" as const, textAlign: "left" as const }
                    : {}),
                  ...(isLiberado
                    ? { width: `${((232 / PAGE_W) * 100).toFixed(4)}%`, textAlign: "center" as const }
                    : {}),
                  ...(isEstado ? { width: `${((cfg.estadoBoxW / PAGE_W) * 100).toFixed(4)}%`, textAlign: "center" as const } : {}),
                  ...(isBox
                    ? {
                        width: `${(((f.w || 80) / PAGE_W) * 100).toFixed(4)}%`,
                        height: `${(((f.h || 80) / PAGE_H) * 100).toFixed(4)}%`,
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
        {(["cnh", "rg", "atestado", "crlv"] as const).map((k) => (
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

