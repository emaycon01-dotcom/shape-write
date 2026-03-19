/** Maps state abbreviation to its coat of arms image URL and full name */

export const ESTADO_NOMES: Record<string, string> = {
  AC: "ACRE", AL: "ALAGOAS", AP: "AMAPÁ", AM: "AMAZONAS", BA: "BAHIA",
  CE: "CEARÁ", DF: "DISTRITO FEDERAL", ES: "ESPÍRITO SANTO", GO: "GOIÁS",
  MA: "MARANHÃO", MT: "MATO GROSSO", MS: "MATO GROSSO DO SUL", MG: "MINAS GERAIS",
  PA: "PARÁ", PB: "PARAÍBA", PR: "PARANÁ", PE: "PERNAMBUCO", PI: "PIAUÍ",
  RJ: "RIO DE JANEIRO", RN: "RIO GRANDE DO NORTE", RS: "RIO GRANDE DO SUL",
  RO: "RONDÔNIA", RR: "RORAIMA", SC: "SANTA CATARINA", SP: "SÃO PAULO",
  SE: "SERGIPE", TO: "TOCANTINS",
};

// Coat of arms URLs from Wikimedia Commons (SVG rendered as PNG via thumb)
const WIKI_BASE = "https://upload.wikimedia.org/wikipedia/commons/thumb";

export const BRASAO_URLS: Record<string, string> = {
  AC: `${WIKI_BASE}/4/4c/Brasão_do_Acre.svg/120px-Brasão_do_Acre.svg.png`,
  AL: `${WIKI_BASE}/1/17/Brasão_de_Alagoas.svg/120px-Brasão_de_Alagoas.svg.png`,
  AP: `${WIKI_BASE}/b/ba/Brasão_do_Amapá.svg/120px-Brasão_do_Amapá.svg.png`,
  AM: `${WIKI_BASE}/0/0c/Brasão_do_Amazonas.svg/120px-Brasão_do_Amazonas.svg.png`,
  BA: `${WIKI_BASE}/6/6e/Brasão_da_Bahia.svg/120px-Brasão_da_Bahia.svg.png`,
  CE: `${WIKI_BASE}/a/a2/Brasão_do_Ceará.svg/120px-Brasão_do_Ceará.svg.png`,
  DF: `${WIKI_BASE}/d/d4/Brasão_do_Distrito_Federal_%28Brasil%29.svg/120px-Brasão_do_Distrito_Federal_%28Brasil%29.svg.png`,
  ES: `${WIKI_BASE}/4/43/Brasão_do_Espírito_Santo.svg/120px-Brasão_do_Espírito_Santo.svg.png`,
  GO: `${WIKI_BASE}/b/be/Brasão_de_Goiás.svg/120px-Brasão_de_Goiás.svg.png`,
  MA: `${WIKI_BASE}/0/0b/Brasão_do_Maranhão.svg/120px-Brasão_do_Maranhão.svg.png`,
  MT: `${WIKI_BASE}/c/c2/Brasão_de_Mato_Grosso.svg/120px-Brasão_de_Mato_Grosso.svg.png`,
  MS: `${WIKI_BASE}/a/a3/Brasão_de_Mato_Grosso_do_Sul.svg/120px-Brasão_de_Mato_Grosso_do_Sul.svg.png`,
  MG: `${WIKI_BASE}/2/2c/Brasão_de_Minas_Gerais.svg/120px-Brasão_de_Minas_Gerais.svg.png`,
  PA: `${WIKI_BASE}/d/d5/Brasão_do_Pará.svg/120px-Brasão_do_Pará.svg.png`,
  PB: `${WIKI_BASE}/9/9a/Brasão_da_Paraíba.svg/120px-Brasão_da_Paraíba.svg.png`,
  PR: `${WIKI_BASE}/e/e2/Brasão_do_Paraná.svg/120px-Brasão_do_Paraná.svg.png`,
  PE: `${WIKI_BASE}/8/8d/Brasão_de_Pernambuco.svg/120px-Brasão_de_Pernambuco.svg.png`,
  PI: `${WIKI_BASE}/3/33/Brasão_do_Piauí.svg/120px-Brasão_do_Piauí.svg.png`,
  RJ: `${WIKI_BASE}/3/3e/Brasão_do_estado_do_Rio_de_Janeiro.svg/120px-Brasão_do_estado_do_Rio_de_Janeiro.svg.png`,
  RN: `${WIKI_BASE}/3/3b/Brasão_do_Rio_Grande_do_Norte.svg/120px-Brasão_do_Rio_Grande_do_Norte.svg.png`,
  RS: `${WIKI_BASE}/4/4e/Brasão_do_Rio_Grande_do_Sul.svg/120px-Brasão_do_Rio_Grande_do_Sul.svg.png`,
  RO: `${WIKI_BASE}/6/62/Brasão_de_Rondônia.svg/120px-Brasão_de_Rondônia.svg.png`,
  RR: `${WIKI_BASE}/7/72/Brasão_de_Roraima.svg/120px-Brasão_de_Roraima.svg.png`,
  SC: `${WIKI_BASE}/d/d4/Brasão_de_Santa_Catarina.svg/120px-Brasão_de_Santa_Catarina.svg.png`,
  SP: `${WIKI_BASE}/0/0d/Brasão_do_estado_de_São_Paulo.svg/120px-Brasão_do_estado_de_São_Paulo.svg.png`,
  SE: `${WIKI_BASE}/3/34/Brasão_de_Sergipe.svg/120px-Brasão_de_Sergipe.svg.png`,
  TO: `${WIKI_BASE}/0/0e/Brasão_do_Tocantins.svg/120px-Brasão_do_Tocantins.svg.png`,
};

/** Load a brasão image. Returns an HTMLImageElement or null on failure. */
export function loadBrasaoImage(uf: string): Promise<HTMLImageElement | null> {
  const url = BRASAO_URLS[uf];
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
