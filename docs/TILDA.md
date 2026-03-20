# Tilda Embedding Guide

## Goal
Embed this static demo into Tilda pages using HTML blocks.

## Prepare pages in Tilda
Create Tilda pages that mirror the static website:
- Home
- For Owners
- For Clinics
- Pricing
- Security
- FAQ
- Auth Demo
- Cabinet Demo

## Method A (quick demo): paste HTML directly into T123
Recommended for rapid prototype demos.

1. In Tilda, open target page.
2. Add block: **T123 (Embed HTML Code)**.
3. Open local source file (`site/<page>.html`) and copy relevant HTML content.
4. Paste into T123 block.
5. Save and publish page.

### Modules with Method A
For each module:
1. Add a separate T123 block.
2. Open module file (`modules/module-*.html`).
3. Copy full module HTML and paste into that block.
4. Publish and test module behavior.

This method is best for quick internal demo and testing.

## Method B (clean separation): host static files and embed via iframe
Recommended for cleaner maintenance.

1. Host this project as static files (for example on any static hosting platform).
2. Ensure public URLs for:
   - Site pages: `/site/*.html`
   - Modules: `/modules/*.html`
3. In Tilda, add T123 block.
4. Paste iframe code, for example:

```html
<iframe
  src="https://your-domain.example/modules/module-triage.html"
  style="width:100%; min-height:760px; border:0; border-radius:14px;"
  loading="lazy"
></iframe>
```

5. Repeat for each module/page as needed.

## Suggested Tilda mapping
- Tilda page “Home” -> embedded `site/index.html` sections or rebuilt layout + module iframes.
- “For Clinics” -> `site/clinics.html`.
- “For Owners” -> `site/owners.html`.
- “Security” -> `site/security.html` (contains AI architecture section).
- “Auth Demo” -> `site/auth.html`.
- “Cabinet Demo” -> `site/cabinet.html`.

## Notes
- Under `file://` local mode, some browsers may restrict iframe behavior.
- If needed, open modules directly in new tab, or use hosted Method B.
- This demo intentionally does not include real backend or personal-data storage.
