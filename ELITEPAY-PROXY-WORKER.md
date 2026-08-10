# Proxy ElitePay (Cloudflare Worker) — solução para o erro 403 "Request Blocked"

## Por que precisa disso

A API da ElitePay (`api.elitepaybr.com`) está atrás do WAF da Square Cloud/Cloudflare.
Testes feitos daqui provam que:

- Chamando de um servidor comum → **200 OK** (credenciais válidas, tudo certo).
- Chamando do runtime das nossas funções → **403 "Request Blocked"** (bloqueio por IP/ASN, não por credencial).

Ou seja: **a chave nova está correta**. O bloqueio é do WAF contra a faixa de IPs do nosso backend.

## Duas saídas

### Opção A (melhor, sem custo): pedir liberação à ElitePay

Abra um chamado no suporte da ElitePay pedindo para **liberar (allowlist) as chamadas de servidor**
para a conta `ep_f2341ff3...` — informe que as requisições estão recebendo
`403 Square Cloud | Request Blocked` mesmo com credenciais válidas.

### Opção B: proxy próprio via Cloudflare Worker (5 minutos, grátis)

1. Acesse https://dash.cloudflare.com → **Workers & Pages** → **Create Worker**.
2. Cole o código abaixo, troque `SEU_TOKEN_SECRETO` por um valor aleatório e **Deploy**.
3. Copie a URL do worker (ex.: `https://elitepay-proxy.SEUNOME.workers.dev`).
4. Me mande a URL e o token — eu salvo como `ELITEPAY_PROXY_URL` e `ELITEPAY_PROXY_TOKEN`
   e o PIX volta a funcionar na hora (o código já suporta esses dois segredos).

```js
const TARGET = "https://api.elitepaybr.com";
const PROXY_TOKEN = "SEU_TOKEN_SECRETO";

export default {
  async fetch(request) {
    if (request.headers.get("x-proxy-token") !== PROXY_TOKEN) {
      return new Response("forbidden", { status: 403 });
    }
    const url = new URL(request.url);
    const target = TARGET + url.pathname + url.search;

    const headers = new Headers(request.headers);
    headers.delete("x-proxy-token");
    headers.delete("host");
    headers.set("User-Agent", "curl/8.4.0");
    headers.set("Accept", "*/*");

    const res = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
    });

    return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") || "application/json" } });
  },
};
```

> Enquanto isso, o `reconcile-pix` (cron de 1 minuto) e o webhook continuam funcionando —
> mas eles só ajudam **depois** que a cobrança é criada, e é justamente a criação que está bloqueada.
