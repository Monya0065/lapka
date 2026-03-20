# Vet Platform Demo (Safety-Critical, Static)

## What is included
This project is a fully static demo website for veterinary workflow organization and safety awareness.
It includes:
- Multi-page website (`site/*.html`)
- Shared styles/scripts (`assets/css/styles.css`, `assets/js/app.js`, `assets/js/embed.js`)
- Standalone demo modules (`modules/*.html`)
- Tilda embedding guide (`docs/TILDA.md`)

The demo is **not** a diagnosis system and **not** a treatment engine.

## Folder structure

```text
site/
  index.html
  clinics.html
  owners.html
  pricing.html
  security.html
  faq.html
  auth.html
  cabinet.html

assets/
  css/
    styles.css
  js/
    app.js
    embed.js
  img/

modules/
  module-triage.html
  module-dose.html
  module-fluids.html
  module-cri.html
  module-rer.html
  module-qr.html
  module-protocol.html

docs/
  README.md
  TILDA.md
```

## How to run locally
1. Open `site/index.html` in browser.
2. Navigate across pages through header links.
3. All modules are standalone in `modules/` and can be opened directly.

### file:// note
On some browsers, `iframe` sizing may be limited under `file://` restrictions.
- If an embedded module does not render correctly inside the landing page iframe, open that module directly in a new tab from provided links.

## Safety boundaries implemented
- No diagnosis output.
- No medication names.
- No AI dosing recommendation or treatment replacement instructions.
- Triage provides urgency level only: GREEN / YELLOW / RED.
- RED flags trigger stop-the-line behavior and emergency transport-only guidance.

## Modules summary
- `module-triage.html`: deterministic urgency triage with red-flag override.
- `module-dose.html`: math-only dose arithmetic from user values.
- `module-fluids.html`: math-only fluids arithmetic from user values.
- `module-cri.html`: unit-safe infusion conversion math.
- `module-rer.html`: RER/MER formula calculator with manual multiplier.
- `module-qr.html`: real QR generation on canvas (pure JS, no external library).
- `module-protocol.html`: visit protocol preview + copy + print-to-PDF.

## Tilda embedding
See [TILDA.md](./TILDA.md) for step-by-step setup.

## Acceptance tests

### 1) Calculator inputs
- Empty required fields -> clear error shown in aria-live region.
- Zero/negative/out-of-range values -> validation error.
- Huge values outside ranges -> validation error.
- Comma decimals (example `1,5`) are parsed correctly.
- Rounding modes 0/1/2 decimals affect output format.
- Reset button clears result and errors.

### 2) CRI conversion correctness
Use:
- `weight_kg = 10`
- `concentration_mg_per_ml = 2`
- `infusion_rate_ml_per_hr = 5`
Expected:
- `mg_per_hr = 10`
- `delivered_mg_per_kg_hr = 1`
- `delivered_mcg_per_kg_min = 16.67` (rounded to 2 decimals)

### 3) Fluids dehydration warning
Use dehydration percent `> 15` (e.g. `16`).
Expected:
- Warning message appears.
- Calculation still executes if all values valid.

### 4) QR
- Short URL (e.g. `https://example.com`) generates a scannable QR canvas.
- Input length `>120 chars` -> explicit error.
- Download PNG button exports QR image file.

### 5) Protocol
- Generate populates preview.
- Copy copies preview text to clipboard (if permission allows).
- Export PDF opens print dialog (`window.print()`), usable for Save as PDF.

### 6) Triage
- Any red flag checked -> immediate RED + panic block + transport-only guidance.
- Output contains required RU/EN triage disclaimer.
- No diagnosis, no drug names, no treatment instructions from AI output.
- Age modifier affects urgency and score (age < 6 months and/or senior).

### 7) Language toggle
- RU default text shown on each `site/*.html` page.
- Toggle button switches key UI text to EN.
- `document.title` and meta description update with selected language.
