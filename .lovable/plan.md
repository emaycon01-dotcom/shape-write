

## Plano: Atualizar template PDF e formatos dos campos da CNH Física

### O que será feito

**1. Substituir o PDF template** (`public/assets/template-cnh-fisica.pdf`) pelo PDF enviado (`PDF_CORRETO.pdf`). Este PDF será usado:
- No **preview** (via iframe)
- No **PDF final** (mesclagem da página 2/verso com QR code)
- No **módulo de alinhamento** (extração das páginas como background)

A lógica e configuração atuais permanecem inalteradas — apenas o arquivo PDF será trocado.

**2. Ajustar os comprimentos dos campos gerados automaticamente** no formulário (`fillTest`) para corresponder ao formato real da CNH mostrada na imagem:

| Campo | Atual | Novo (conforme imagem) |
|-------|-------|----------------------|
| `registro` | 11 dígitos | **9 dígitos** (`069025817`) |
| `renach` | UF + 9 dígitos (11 total) | UF + **9 dígitos** (mantém) |
| `numeroEspelho` | 11 dígitos | **9 dígitos** |
| `codigoSeguranca` | 11 dígitos | **11 dígitos** (mantém) |

O MRZ já usa `slice(0, 9)` para o docNumber, mas o campo visível no cartão também deve exibir 9 dígitos para consistência visual.

### Arquivos a editar

1. **`public/assets/template-cnh-fisica.pdf`** — substituir pelo PDF enviado
2. **`src/pages/CnhFisicaFormPage.tsx`** — ajustar `generateRandom` nos campos `registro` e `numeroEspelho` de 11 para 9 dígitos

### Sem alterações em

- Edge function (lógica de mesclagem e MRZ permanece igual)
- Módulo de alinhamento (usa o mesmo PDF/imagens, lógica inalterada)
- Preview page (lógica inalterada)

