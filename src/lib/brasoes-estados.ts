/** Brasões oficiais dos 27 estados (assets locais) + nomes por extenso. */

import AC from "@/assets/brasoes/AC.png.asset.json";
import AL from "@/assets/brasoes/AL.png.asset.json";
import AP from "@/assets/brasoes/AP.png.asset.json";
import AM from "@/assets/brasoes/AM.png.asset.json";
import BA from "@/assets/brasoes/BA.png.asset.json";
import CE from "@/assets/brasoes/CE.png.asset.json";
import DF from "@/assets/brasoes/DF.png.asset.json";
import ES from "@/assets/brasoes/ES.png.asset.json";
import GO from "@/assets/brasoes/GO.png.asset.json";
import MA from "@/assets/brasoes/MA.png.asset.json";
import MT from "@/assets/brasoes/MT.png.asset.json";
import MS from "@/assets/brasoes/MS.png.asset.json";
import MG from "@/assets/brasoes/MG.png.asset.json";
import PA from "@/assets/brasoes/PA.png.asset.json";
import PB from "@/assets/brasoes/PB.png.asset.json";
import PR from "@/assets/brasoes/PR.png.asset.json";
import PE from "@/assets/brasoes/PE.png.asset.json";
import PI from "@/assets/brasoes/PI.png.asset.json";
import RJ from "@/assets/brasoes/RJ.png.asset.json";
import RN from "@/assets/brasoes/RN.png.asset.json";
import RS from "@/assets/brasoes/RS.png.asset.json";
import RO from "@/assets/brasoes/RO.png.asset.json";
import RR from "@/assets/brasoes/RR.png.asset.json";
import SC from "@/assets/brasoes/SC.png.asset.json";
import SP from "@/assets/brasoes/SP.png.asset.json";
import SE from "@/assets/brasoes/SE.png.asset.json";
import TO from "@/assets/brasoes/TO.png.asset.json";

export const ESTADO_NOMES: Record<string, string> = {
  AC: "ACRE", AL: "ALAGOAS", AP: "AMAPÁ", AM: "AMAZONAS", BA: "BAHIA",
  CE: "CEARÁ", DF: "DISTRITO FEDERAL", ES: "ESPÍRITO SANTO", GO: "GOIÁS",
  MA: "MARANHÃO", MT: "MATO GROSSO", MS: "MATO GROSSO DO SUL", MG: "MINAS GERAIS",
  PA: "PARÁ", PB: "PARAÍBA", PR: "PARANÁ", PE: "PERNAMBUCO", PI: "PIAUÍ",
  RJ: "RIO DE JANEIRO", RN: "RIO GRANDE DO NORTE", RS: "RIO GRANDE DO SUL",
  RO: "RONDÔNIA", RR: "RORAIMA", SC: "SANTA CATARINA", SP: "SÃO PAULO",
  SE: "SERGIPE", TO: "TOCANTINS",
};

/** URL (CDN do projeto) do brasão de cada UF. */
export const BRASAO_URLS: Record<string, string> = {
  AC: AC.url, AL: AL.url, AP: AP.url, AM: AM.url, BA: BA.url, CE: CE.url,
  DF: DF.url, ES: ES.url, GO: GO.url, MA: MA.url, MT: MT.url, MS: MS.url,
  MG: MG.url, PA: PA.url, PB: PB.url, PR: PR.url, PE: PE.url, PI: PI.url,
  RJ: RJ.url, RN: RN.url, RS: RS.url, RO: RO.url, RR: RR.url, SC: SC.url,
  SP: SP.url, SE: SE.url, TO: TO.url,
};

const brasaoDataUrlCache: Record<string, string> = {};
const LS_PREFIX = "brasao-dataurl-v2-";

/**
 * Retorna o brasão do estado como data URL, pronto para ser embutido no HTML
 * da geração (sem CORS, pois o arquivo é servido pelo próprio projeto).
 */
export async function loadBrasaoDataUrl(uf: string): Promise<string> {
  const key = (uf || "").toUpperCase();
  if (!key) return "";
  if (brasaoDataUrlCache[key]) return brasaoDataUrlCache[key];

  try {
    const cached = localStorage.getItem(LS_PREFIX + key);
    if (cached) {
      brasaoDataUrlCache[key] = cached;
      return cached;
    }
  } catch { /* storage indisponível */ }

  const url = BRASAO_URLS[key];
  if (!url) return "";

  try {
    const blob = await (await fetch(url)).blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    brasaoDataUrlCache[key] = dataUrl;
    try { localStorage.setItem(LS_PREFIX + key, dataUrl); } catch { /* cota cheia */ }
    return dataUrl;
  } catch (err) {
    console.error(`Falha ao carregar brasão de ${key}:`, err);
    return "";
  }
}

/** Versão em HTMLImageElement (usada em previews em canvas). */
export async function loadBrasaoImage(uf: string): Promise<HTMLImageElement | null> {
  const dataUrl = await loadBrasaoDataUrl(uf);
  if (!dataUrl) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Lista de UFs para selects. */
export const ESTADOS_UF = Object.keys(ESTADO_NOMES).sort();
