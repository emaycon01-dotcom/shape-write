CNH PDF layout rules, field color expectations, and text-format constraints.

## Field Colors
- **Red (#c00):** validade, registro, categoria (cat_big + cat_hab)
- **Black (#111):** all other fields (nome, cpf, rg, espelho, renach, etc.)
- Número espelho must always be black (never red).

## Text Format
- RENACH/MRZ output in two lines (not a single overflowing line).
- Prioritize pixel-level alignment on the left CNH card area.
- Re-validate coordinates whenever template image changes.
