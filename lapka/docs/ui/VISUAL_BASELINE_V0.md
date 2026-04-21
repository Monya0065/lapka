# Visual Baseline V0

This document locks the UI/UX baseline for the visual-first track and defines canonical components and patterns that must be reused across all roles.

## Canonical Foundations

- Global tokens and shell styles:
  - `frontend/app/globals.css`
- Role chrome:
  - `frontend/components/layouts/AppLayout.jsx`
  - `frontend/components/ui/Sidebar.jsx`
  - `frontend/components/ui/WorkspaceHeader.jsx`
- Core primitives:
  - `frontend/components/ui/Button.jsx`
  - `frontend/components/ui/Card.jsx`
  - `frontend/components/ui/Table.jsx`
  - `frontend/components/ui/EmptyState.jsx`
  - `frontend/components/ui/PageHeader.jsx`
  - `frontend/components/ui/Skeleton.jsx`
  - `frontend/components/ui/ErrorBanner.jsx`

## Visual Contract (Do/Don't)

- **Do** use `Button` variants (`primary`, `secondary`, `danger`, `subtle`, `ghost`) for all new CTAs.
- **Do** use `Card` as the only section shell on workspace pages.
- **Do** use `PageHeader` or a single equivalent header pattern per page.
- **Do** use `Table` for operational grids unless an explicit reason is documented.
- **Do** use `EmptyState`, `Skeleton`, and `ErrorBanner` for empty/loading/error states.
- **Do not** add page-specific ad-hoc patterns if a canonical primitive exists.
- **Do not** introduce one-off spacing, radius, or shadow rules outside tokenized classes in `globals.css`.

## Baseline Scope (Wave 1)

Primary unification targets:

- `frontend/app/owner/dashboard/page.jsx`
- `frontend/app/vet/dashboard/page.jsx`
- `frontend/app/clinic/dashboard/page.jsx`
- `frontend/app/platform/dashboard/page.jsx`
- `frontend/app/platform/ai/page.jsx`

Role layout checks:

- `frontend/components/layouts/OwnerLayout.jsx`
- `frontend/components/layouts/VetLayout.jsx`
- `frontend/components/layouts/ClinicLayout.jsx`
- `frontend/components/layouts/PlatformLayout.jsx`

## i18n Display Normalization Standard

Backend-driven display strings that can vary by locale/content type must be normalized through helper maps with fallback behavior.

Reference implementation:

- `frontend/lib/platform-ai-i18n.mjs`
- `frontend/tests/platform-ai-i18n.test.mjs`
- `frontend/tests/platform-ai-i18n.edge.test.mjs`
- `frontend/tests/platform-ai-i18n.modes.test.mjs`

## Definition of Done for Visual V0

- Canonical patterns are used on all Wave 1 pages.
- No new ad-hoc visual primitives are introduced.
- RU/EN labels are consistent in high-impact screens.
- `npm run test:unit`, `npm run lint`, and `npm run build` pass in `frontend`.
