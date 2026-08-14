/**
 * PIX estático (BR Code / EMV) — usado enquanto o gateway automático está fora.
 * O pagamento cai direto na chave abaixo e a liberação é feita manualmente.
 */
export const PIX_KEY = "de70d50c-ce31-4ef1-bff5-5cfaccb26a7a";
export const PIX_MERCHANT_NAME = "MONKEYLAB";
export const PIX_MERCHANT_CITY = "RECIFE";

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .slice(0, max);
}

/** Gera o código copia-e-cola do PIX estático com valor definido. */
export function buildStaticPixCode(amount: number, txid = "***"): string {
  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", PIX_KEY);
  const safeTxid = sanitize(txid, 25).replace(/ /g, "") || "***";

  let payload =
    tlv("00", "01") +
    tlv("26", merchantAccount) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", amount.toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", sanitize(PIX_MERCHANT_NAME, 25)) +
    tlv("60", sanitize(PIX_MERCHANT_CITY, 15)) +
    tlv("62", tlv("05", safeTxid));

  payload += "6304";
  return payload + crc16(payload);
}
