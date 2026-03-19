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

// Wikipedia page titles for each state's coat of arms - used with the REST API
const BRASAO_WIKI_FILES: Record<string, string> = {
  AC: "Bras%C3%A3o_do_Acre",
  AL: "Bras%C3%A3o_de_Alagoas",
  AP: "Bras%C3%A3o_do_Amap%C3%A1",
  AM: "Bras%C3%A3o_do_Amazonas",
  BA: "Bras%C3%A3o_da_Bahia",
  CE: "Bras%C3%A3o_do_Cear%C3%A1",
  DF: "Bras%C3%A3o_do_Distrito_Federal_(Brasil)",
  ES: "Bras%C3%A3o_do_Esp%C3%ADrito_Santo",
  GO: "Bras%C3%A3o_de_Goi%C3%A1s",
  MA: "Bras%C3%A3o_do_Maranh%C3%A3o",
  MT: "Bras%C3%A3o_de_Mato_Grosso",
  MS: "Bras%C3%A3o_de_Mato_Grosso_do_Sul",
  MG: "Bras%C3%A3o_de_Minas_Gerais",
  PA: "Bras%C3%A3o_do_Par%C3%A1",
  PB: "Bras%C3%A3o_da_Para%C3%ADba",
  PR: "Bras%C3%A3o_do_Paran%C3%A1",
  PE: "Bras%C3%A3o_de_Pernambuco",
  PI: "Bras%C3%A3o_do_Piau%C3%AD",
  RJ: "Bras%C3%A3o_do_estado_do_Rio_de_Janeiro",
  RN: "Bras%C3%A3o_do_Rio_Grande_do_Norte",
  RS: "Bras%C3%A3o_do_Rio_Grande_do_Sul",
  RO: "Bras%C3%A3o_de_Rond%C3%B4nia",
  RR: "Bras%C3%A3o_de_Roraima",
  SC: "Bras%C3%A3o_de_Santa_Catarina",
  SP: "Bras%C3%A3o_do_estado_de_S%C3%A3o_Paulo",
  SE: "Bras%C3%A3o_de_Sergipe",
  TO: "Bras%C3%A3o_do_Tocantins",
};

// Cache for loaded brasão images
const brasaoCache: Record<string, HTMLImageElement | null> = {};

/**
 * Load a brasão image via Wikimedia Commons API (avoids CORS issues).
 * Uses fetch to get the image as blob, then creates an object URL.
 * Returns an HTMLImageElement or null on failure.
 */
export async function loadBrasaoImage(uf: string): Promise<HTMLImageElement | null> {
  // Return cached version if available
  if (uf in brasaoCache) return brasaoCache[uf];

  const fileName = BRASAO_WIKI_FILES[uf];
  if (!fileName) {
    brasaoCache[uf] = null;
    return null;
  }

  try {
    // Use Wikimedia Commons API to get the actual image URL with proper CORS
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${fileName}.svg&prop=imageinfo&iiprop=url&iiurlwidth=200&format=json&origin=*`;
    const apiRes = await fetch(apiUrl);
    const apiData = await apiRes.json();
    
    const pages = apiData?.query?.pages;
    if (!pages) throw new Error("No pages");
    
    const pageId = Object.keys(pages)[0];
    const imageInfo = pages[pageId]?.imageinfo?.[0];
    const thumbUrl = imageInfo?.thumburl;
    
    if (!thumbUrl) throw new Error("No thumb URL");

    // Fetch the actual image as blob to avoid CORS canvas tainting
    const imgRes = await fetch(thumbUrl);
    const blob = await imgRes.blob();
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        brasaoCache[uf] = img;
        resolve(img);
      };
      img.onerror = () => {
        brasaoCache[uf] = null;
        resolve(null);
      };
      img.src = blobUrl;
    });
  } catch (err) {
    console.error(`Failed to load brasão for ${uf}:`, err);
    brasaoCache[uf] = null;
    return null;
  }
}
