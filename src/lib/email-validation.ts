/**
 * Validação de e-mail no cadastro.
 *
 * Endereços inválidos, com erro de digitação ou temporários geram devoluções
 * (bounces) no envio do código de verificação. Uma taxa alta de devoluções faz
 * o provedor restringir o envio de todo o sistema — por isso barramos antes.
 *
 * A checagem local roda sempre; a checagem remota (DNS do domínio + lista de
 * endereços que já devolveram) é um complemento e nunca bloqueia o cadastro se
 * estiver indisponível.
 */

const EMAIL_RE =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

const DISPOSABLE = new Set([
  "mailinator.com", "tempmail.com", "temp-mail.org", "10minutemail.com",
  "guerrillamail.com", "guerrillamail.info", "sharklasers.com", "yopmail.com",
  "trashmail.com", "getnada.com", "dispostable.com", "fakeinbox.com",
  "maildrop.cc", "mailnesia.com", "throwawaymail.com", "moakt.com",
  "emailondeck.com", "spamgourmet.com", "mytemp.email", "tempr.email",
  "inboxkitten.com", "mail.tm", "minuteinbox.com", "temporary-mail.net",
]);

const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmail.co": "gmail.com",
  "gmail.con": "gmail.com", "gmails.com": "gmail.com", "gemail.com": "gmail.com",
  "gmail.com.br": "gmail.com", "hotmial.com": "hotmail.com",
  "hotmail.con": "hotmail.com", "hotmai.com": "hotmail.com", "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com", "outloo.com": "outlook.com", "outlook.con": "outlook.com",
  "yahho.com": "yahoo.com", "yaho.com": "yahoo.com", "yahoo.con": "yahoo.com",
  "icloud.con": "icloud.com", "iclod.com": "icloud.com",
  "bol.com": "bol.com.br", "uol.com": "uol.com.br", "hotmail.com.br": "hotmail.com",
};

const REMOTE_URL = "https://doycwownddyxfqntifca.supabase.co/functions/v1/validate-email";
const REMOTE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWN3b3duZGR5eGZxbnRpZmNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDYzMTYsImV4cCI6MjA4OTAyMjMxNn0.kpk695Xomza4QBmD8FtdkNSMmJS1bFQyc6YSuvxpEbI";

export interface EmailCheck {
  valid: boolean;
  reason?: string;
  suggestion?: string;
}

export function checkEmailLocally(raw: string): EmailCheck {
  const value = raw.trim().toLowerCase();

  if (!EMAIL_RE.test(value)) {
    return { valid: false, reason: "E-mail inválido. Confira o endereço digitado." };
  }

  const [local, domain] = value.split("@");

  if (TYPOS[domain]) {
    return {
      valid: false,
      reason: `Domínio inválido. Você quis dizer @${TYPOS[domain]}?`,
      suggestion: `${local}@${TYPOS[domain]}`,
    };
  }

  if (DISPOSABLE.has(domain)) {
    return { valid: false, reason: "E-mails temporários não são aceitos. Use um endereço permanente." };
  }

  return { valid: true };
}

export async function validateEmailAddress(raw: string): Promise<EmailCheck> {
  const local = checkEmailLocally(raw);
  if (!local.valid) return local;

  try {
    const res = await fetch(REMOTE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: REMOTE_KEY,
        Authorization: `Bearer ${REMOTE_KEY}`,
      },
      body: JSON.stringify({ email: raw.trim().toLowerCase() }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { valid: true };
    const json = await res.json();
    if (json && json.valid === false) {
      return { valid: false, reason: json.reason, suggestion: json.suggestion };
    }
  } catch {
    // Checagem remota indisponível — o cadastro segue com a validação local.
  }

  return { valid: true };
}
