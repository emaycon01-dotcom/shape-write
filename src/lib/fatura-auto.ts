/**
 * Automação de valores e códigos das faturas (comprovantes de residência).
 *
 * Objetivo: o cliente informa apenas os dados pessoais + o VALOR TOTAL da fatura.
 * Todo o resto (impostos, tarifas, bases de cálculo, consumo, leituras, chaves,
 * protocolos, códigos de barras) é gerado automaticamente — com a matemática
 * fechando com o total informado.
 */

// ---------------------------------------------------------------- utilidades

export const randDigits = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");

export const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const randFloat = (min: number, max: number, decimals = 2) =>
  Number((Math.random() * (max - min) + min).toFixed(decimals));

/** "1234.5" -> "1.234,50" */
export const fmtBRL = (v: number, decimals = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** "1.234,50" -> 1234.5 */
export const parseBRL = (v: string): number => {
  const cleaned = String(v ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const pad = (n: number) => String(n).padStart(2, "0");

export const fmtDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

export const parseDateBR = (v: string): Date | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((v ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
};

export const addDays = (d: Date, days: number) => {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
};

const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export const refMesAno = (d: Date) => `${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
export const refMesAbrev = (d: Date) => `${MESES[d.getMonth()]}/${d.getFullYear()}`;

export const randHora = () =>
  `${pad(randInt(8, 19))}:${pad(randInt(0, 59))}:${pad(randInt(0, 59))}`;

/** Chave de acesso NF-e/NF3e com 44 dígitos. */
export const randChaveAcesso = (uf = "29") => `${uf}${randDigits(42)}`;

/** Base de datas coerentes a partir do vencimento (ou de hoje). */
export function baseDatas(vencimento?: string) {
  const venc = parseDateBR(vencimento ?? "") ?? addDays(new Date(), 12);
  const leituraAtual = addDays(venc, -14);
  const leituraAnterior = addDays(leituraAtual, -30);
  const proximaLeitura = addDays(leituraAtual, 30);
  const emissao = addDays(leituraAtual, 1);
  return { venc, leituraAtual, leituraAnterior, proximaLeitura, emissao, dias: 30 };
}

// -------------------------------------------------------------------- ENEL

export interface EnelAuto {
  consumoKwh: string;
  tarifaTusd: string;
  tarifaTe: string;
  aliquotaIcms: string;
  cosip: string;
  leituraAnteriorMedidor: string;
  leituraAtualMedidor: string;
  medidor: string;
  instalacao: string;
  numeroCliente: string;
  numeroConta: string;
  notaFiscal: string;
  chaveNf: string;
  codigoDebito: string;
  unidadeEntrega: string;
  sequencia: string;
  cb1: string;
  cb2: string;
  cb3: string;
  cb4: string;
}

export function autoEnel(totalStr: string): EnelAuto {
  const total = parseBRL(totalStr) || randFloat(90, 320);
  const cosip = Number((total * randFloat(0.03, 0.06, 4)).toFixed(2));
  const base = Math.max(total - cosip, 1);

  const tusd = randFloat(0.38, 0.49, 5);
  const teAprox = randFloat(0.3, 0.38, 5);
  const consumo = Math.max(1, Math.round(base / (tusd + teAprox)));
  // ajusta a TE para o consumo inteiro fechar exatamente com a base
  const te = Number((base / consumo - tusd).toFixed(5));

  const leituraAnt = randInt(4000, 48000);
  const leituraAtu = leituraAnt + consumo;

  const chave = randChaveAcesso("35");

  return {
    consumoKwh: String(consumo),
    tarifaTusd: fmtBRL(tusd, 5),
    tarifaTe: fmtBRL(te, 5),
    aliquotaIcms: String([12, 18, 20][randInt(0, 2)]),
    cosip: fmtBRL(cosip),
    leituraAnteriorMedidor: leituraAnt.toLocaleString("pt-BR"),
    leituraAtualMedidor: leituraAtu.toLocaleString("pt-BR"),
    medidor: randDigits(8),
    instalacao: randDigits(9),
    numeroCliente: randDigits(9),
    numeroConta: randDigits(12),
    notaFiscal: randDigits(9),
    chaveNf: (chave.match(/.{1,4}/g) ?? []).join(" "),
    codigoDebito: randDigits(9),
    unidadeEntrega: `B${randDigits(7)}`,
    sequencia: randDigits(4),
    cb1: `8364${randDigits(7)}`,
    cb2: randDigits(11),
    cb3: randDigits(11),
    cb4: randDigits(11),
  };
}

// ------------------------------------------------------------------ COELBA

export interface CoelbaAuto {
  notaFiscal: string;
  chaveAcesso: string;
  protocolo: string;
  protocoloHora: string;
  medLeituraAnterior: string;
  medLeituraAtual: string;
  medConsumo: string;
  medConstante: string;
  medPostos: string;
}

export function autoCoelba(totalStr: string): CoelbaAuto {
  const total = parseBRL(totalStr) || randFloat(90, 600);
  const tarifa = randFloat(0.95, 1.35, 4); // R$/kWh já com tributos
  const consumo = Math.max(1, Math.round(total / tarifa));
  const leituraAnt = randInt(4000, 40000);
  const leituraAtu = leituraAnt + consumo;

  return {
    notaFiscal: randDigits(9),
    chaveAcesso: randChaveAcesso("29"),
    protocolo: randDigits(16),
    protocoloHora: randHora(),
    medLeituraAnterior: fmtBRL(leituraAnt),
    medLeituraAtual: fmtBRL(leituraAtu),
    medConsumo: fmtBRL(consumo),
    medConstante: "1,00000",
    medPostos: "Único",
  };
}

// -------------------------------------------------------------- EQUATORIAL

export interface EquatorialAuto {
  notaFiscal: string;
  horaEmissao: string;
  itUnid: string;
  itQuant: string;
  itPrecoUnit: string;
  itValor: string;
  itPis: string;
  itBaseIcms: string;
  itAliquota: string;
  itIcms: string;
  itTarifa: string;
  fin1Valor: string;
  fin2Valor: string;
  fin3Desc: string;
  fin3Valor: string;
  fin4Desc: string;
  fin4Valor: string;
  infoL1: string;
  infoL2: string;
  unidadeConsumidora: string;
  numeroReferencia: string;
  nossoNumero: string;
  unidadeEntrega: string;
  sequencia: string;
  medidor: string;
}

export function autoEquatorial(totalStr: string, referencia?: string): EquatorialAuto {
  const total = parseBRL(totalStr) || randFloat(80, 400);

  // itens financeiros: bônus (negativo), iluminação pública, juros e multa
  const bonus = -Number((total * randFloat(0.02, 0.06, 4)).toFixed(2));
  const cip = Number((total * randFloat(0.06, 0.14, 4)).toFixed(2));
  const juros = Number((total * randFloat(0.0005, 0.002, 5)).toFixed(2));
  const multa = Number((total * randFloat(0.01, 0.025, 4)).toFixed(2));

  // valor do consumo fecha o total exatamente
  const valorConsumo = Number((total - (bonus + cip + juros + multa)).toFixed(2));

  const precoAprox = randFloat(0.72, 0.95, 6);
  const quant = Math.max(1, Math.round(valorConsumo / precoAprox));
  const preco = Number((valorConsumo / quant).toFixed(6));

  const aliquota = 17;
  const icms = Number((valorConsumo * (aliquota / 100)).toFixed(2));
  const pis = Number((valorConsumo * randFloat(0.02, 0.03, 4)).toFixed(2));
  const tarifa = Number((preco * (1 - aliquota / 100)).toFixed(6));

  const usoSistema = Number((valorConsumo * 0.48).toFixed(2));
  const fornecimento = Number((valorConsumo * 0.42).toFixed(2));
  const transmissao = Number((valorConsumo * 0.06).toFixed(2));
  const encargos = Number((valorConsumo - usoSistema - fornecimento - transmissao).toFixed(2));

  return {
    notaFiscal: randDigits(8),
    horaEmissao: randHora(),
    itUnid: "kWh",
    itQuant: fmtBRL(quant),
    itPrecoUnit: fmtBRL(preco, 6),
    itValor: fmtBRL(valorConsumo),
    itPis: fmtBRL(pis),
    itBaseIcms: fmtBRL(valorConsumo),
    itAliquota: `${aliquota}%`,
    itIcms: fmtBRL(icms),
    itTarifa: fmtBRL(tarifa, 6),
    fin1Valor: fmtBRL(bonus),
    fin2Valor: fmtBRL(cip),
    fin3Desc: "JUROS MORATÓRIA.",
    fin3Valor: fmtBRL(juros),
    fin4Desc: `MULTA - ${referencia || ""}`.trim().replace(/-$/, "").trim() + ".",
    fin4Valor: fmtBRL(multa),
    infoL1: `PARCELA : USO SISTEMA = R$ ${fmtBRL(usoSistema)}   FORNECIMENTO = R$ ${fmtBRL(fornecimento)}  USO TRANSMISSÃO = ${fmtBRL(transmissao)}  ENC. SETORIAL = ${fmtBRL(encargos)}`,
    infoL2: `PERÍODO DE REFERÊNCIA DA APURAÇÃO DOS INDICADORES DE CONTINUIDADE = ${randInt(1, 12)}/${new Date().getFullYear()}. VRC = R$ ${fmtBRL(randFloat(18, 30), 5)}`,
    unidadeConsumidora: randDigits(11),
    numeroReferencia: randDigits(13),
    nossoNumero: `109/${randDigits(8)}-${randDigits(1)}`,
    unidadeEntrega: `${randDigits(2)} / ${randDigits(2)}`,
    sequencia: randDigits(6),
    medidor: `${randDigits(8)}-${randDigits(1)}`,
  };
}

// --------------------------------------------------------------------- TIM

export interface TimLinhaAuto {
  desc: string;
  fran: string;
  cons: string;
  qtd: string;
  val: string;
}

export interface TimAuto {
  cliente: string;
  acesso: string;
  numFatura: string;
  plano: string;
  linhas: TimLinhaAuto[];
}

const PLANOS_TIM = [
  "TIM Controle Smart 2 0",
  "TIM Controle Smart 4 0",
  "TIM Black C 20GB",
  "TIM Controle Express",
];

export function autoTim(totalStr: string, periodo?: string, dias?: string): TimAuto {
  const total = parseBRL(totalStr) || randFloat(39.99, 129.99);
  const plano = PLANOS_TIM[randInt(0, PLANOS_TIM.length - 1)];

  const descBasico = -Number((total * randFloat(0.04, 0.08, 4)).toFixed(2));
  const descFidelizado = -Number((total * randFloat(0.12, 0.22, 4)).toFixed(2));
  const mensalidade = Number((total - descBasico - descFidelizado).toFixed(2));

  const franquia = [5, 8, 10, 20][randInt(0, 3)];

  return {
    cliente: `${randDigits(1)}.${randDigits(9)}`,
    acesso: `${randDigits(2)}-${randDigits(5)}-${randDigits(4)}`,
    numFatura: randDigits(10),
    plano,
    linhas: [
      { desc: `${plano} (096/PÓS/SMP)`, fran: "-", cons: "-", qtd: "1", val: fmtBRL(mensalidade) },
      { desc: `Desconto Basico ${plano}`, fran: "-", cons: "-", qtd: "1", val: fmtBRL(descBasico) },
      { desc: `Desc Fidelizado ${plano}`, fran: "-", cons: "-", qtd: `${randInt(1, 11)}/12`, val: fmtBRL(descFidelizado) },
      { desc: `${franquia}GB Internet`, fran: `${franquia}GB`, cons: "-", qtd: "1", val: "Incluído" },
      { desc: "Minutos Locais e DDD com 41", fran: "Ilimitado", cons: "-", qtd: "1", val: "Incluído" },
      { desc: "Ebook By Skeelo", fran: "-", cons: "-", qtd: "1", val: "Incluído" },
      { desc: "TIM Banca Jornais II", fran: "-", cons: "-", qtd: "1", val: "Incluído" },
    ],
  };
}
