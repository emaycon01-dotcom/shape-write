CNH PDF layout rules, field color expectations, and text-format constraints.

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
