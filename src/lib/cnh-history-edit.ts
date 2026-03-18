const asString = (value: unknown) => (typeof value === "string" ? value : "");

const asBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return false;
};

const asStringArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : String(item).trim()))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [] as string[];
};

export function mapCnhEditPayload(raw: Record<string, unknown>) {
  return {
    formData: {
      cpf: asString(raw.cpf),
      nomeCompleto: asString(raw.nomeCompleto ?? raw.nome_completo),
      uf: asString(raw.uf),
      genero: asString(raw.genero),
      nacionalidade: asString(raw.nacionalidade),
      dataNascimentoLocal: asString(raw.dataNascimentoLocal ?? raw.data_nascimento),
      registro: asString(raw.registro),
      categoria: asString(raw.categoria),
      cnhDefinitiva: asString(raw.cnhDefinitiva ?? raw.cnh_definitiva),
      primeiraHab: asString(raw.primeiraHab ?? raw.data_primeira_habilitacao),
      dataEmissao: asString(raw.dataEmissao ?? raw.data_emissao),
      dataValidade: asString(raw.dataValidade ?? raw.data_validade),
      validadeCatA: asString(raw.validadeCatA ?? raw.validade_cat_a),
      validadeCatB: asString(raw.validadeCatB ?? raw.validade_cat_b),
      validadeCatC: asString(raw.validadeCatC ?? raw.validade_cat_c),
      validadeCatD: asString(raw.validadeCatD ?? raw.validade_cat_d),
      validadeCatE: asString(raw.validadeCatE ?? raw.validade_cat_e),
      validadeCatManual: asBoolean(raw.validadeCatManual),
      cidadeEstado: asString(raw.cidadeEstado ?? raw.cidade_estado),
      estadoExtenso: asString(raw.estadoExtenso ?? raw.estado_extenso),
      rg: asString(raw.rg),
      codigoSeguranca: asString(raw.codigoSeguranca ?? raw.codigo_seguranca),
      renach: asString(raw.renach),
      numeroEspelho: asString(raw.numeroEspelho ?? raw.numero_espelho),
      observacoes: asStringArray(raw.observacoes),
      nomePai: asString(raw.nomePai ?? raw.nome_pai),
      nomeMae: asString(raw.nomeMae ?? raw.nome_mae),
    },
    fotoPreview: asString(raw.fotoBase64 ?? raw.foto_base64) || null,
    assPreview: asString(raw.assinaturaBase64 ?? raw.assinatura_base64) || null,
  };
}

export function buildCnhHistoryFormData(raw: Record<string, unknown>) {
  const mapped = mapCnhEditPayload(raw);

  return {
    ...mapped.formData,
    fotoBase64: mapped.fotoPreview ?? "",
    assinaturaBase64: mapped.assPreview ?? "",
  };
}
