CNH PDF layout rules, field color expectations, and text-format constraints.

## Architecture
- `buildCnhDigitalHtml` — single-page layout for CNH Digital (MRZ on front, has estado field)
- `buildCnhFisicaHtml` — two-page layout for CNH Física (front + verso with MRZ)
- `buildCatDateOverlays(cat, data, tipo)` — pass "digital" or "fisica" for correct positions

## CNH Digital Coordinates (updated 2026-03-17)
photo: 98,167 (82×110) | signature: 93,276 (95×32)
nome: 100,149 | primeira_hab: 308,149 | nascimento: 192,168
emissao: 191,187 | validade: 253,187 | cat_big: 338,184
rg: 190,207 | cpf: 190,226 | registro: 256,226 | cat_hab: 319,226
nacionalidade: 190,246 | pai: 190,266 | mae: 190,286
obs: 97,427 | espelho: 281,495 | renach: 280,509 | local: 100,505
estado: 163,531 | mrz: 80,694
reg_vert_top: 65,315 (12px, -90deg) | reg_vert_bot: 64,558 (11.5px, -90deg)
Cat dates: A(171,353) B(171,375) C(171,397) D(275,342) E(274,375)

## Field Colors
- **Red (#c00):** validade, registro, categoria pequena (cat_hab)
- **Black (#111):** all other fields including categoria grande (cat_big), nome, cpf, rg, espelho, renach, etc.
- Número espelho must always be black (never red).

## Font Weight
- **Normal (default):** All card field values use `font-weight: normal`.
- **Bold:** Only vertical registration text (reg_vert_top, reg_vert_bot) and estado use bold.
- The `.overlay` base class must be `font-weight: normal`.

## Text Format
- RENACH/MRZ output in two lines (not a single overflowing line).
- Prioritize pixel-level alignment on the left CNH card area.
- Re-validate coordinates whenever template image changes.
