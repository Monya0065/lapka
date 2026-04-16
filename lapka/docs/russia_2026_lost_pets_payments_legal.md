# Lost Pets + Payments: legal/security baseline (Russia, 2026)

This document defines the minimum legal and security baseline for the "Lost Pets" module with paid promotion in personal accounts.

## 1) Personal data and consent

- Apply 152-FZ controls for all personal data flows (`phone`, `email`, `geo`, chat content).
- Phone number in a public card is hidden by default; unmasked display only after explicit owner consent.
- Store an immutable audit event for:
  - consent toggle changes,
  - public phone reveal attempts,
  - geo-based notification sends,
  - payment status changes.
- Keep privacy policy and terms versioned; force re-acceptance after legal updates.

## 2) Public listing safeguards

- Enforce anti-abuse limits on public endpoints (IP+scope rate limiting + payload sanitation).
- Add moderation queue for suspicious listings and repeated spam reporters.
- Keep contact bridge privacy-safe by default (masked contact and in-product messaging).

## 3) Paid promotion legal UX

- Paid listing must be clearly marked as promoted/advertising in feed and card.
- Ranking policy must not fully suppress non-paid listings (fair ranking requirement).
- Keep promotion duration and terms visible before checkout.
- Keep public offer text in legal docs: service description, term, refund conditions.

## 4) Payment security (account area)

- Never trust frontend payment flags; promotion activation only from server-side verified payment result.
- Require idempotency key for create-payment and webhook processing.
- Verify webhook signature and reject unsigned/invalid payloads.
- Separate states: `pending`, `succeeded`, `failed`, `refunded`; promotion enabled only on `succeeded`.
- Log payment events in append-only audit stream with actor/IP/request-id.

## 5) Fiscal/legal operations in Russia

- Online receipt and fiscalization flow must comply with 54-FZ through the selected acquirer/provider.
- Display legal entity details, offer terms, and support contacts in account checkout.
- Define refund SLA and conditions in user agreement and offer.
- Store legal acceptance evidence (document version + timestamp + user id).

## 6) Geolocation and clinic notifications

- Explicitly mention geo usage purpose in privacy text ("search nearby lost pets and notify nearby clinics").
- Provide opt-out for owner-initiated clinic notifications.
- Limit clinic notification radius and frequency to prevent spam.

## 7) Release checklist for production

- [ ] Threat model reviewed (payments, chat abuse, PD leaks).
- [ ] DPA/Privacy/Terms versions updated and published.
- [ ] Webhook signature and idempotency tests pass.
- [ ] Promotion labels visible in all list/card variants.
- [ ] Data export/delete requests path documented and tested.
