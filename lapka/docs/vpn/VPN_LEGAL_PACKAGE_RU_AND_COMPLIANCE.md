# VPN Legal Package (RU) and Compliance Checklist

Date: 2026-04-17
Status: Operational legal baseline (requires final counsel review)

## 1. Legal Scope

- Jurisdiction: Russian Federation.
- Business model: paid subscription service (cards + SBP).
- Product positioning: secure channel/privacy tool for lawful use.

## 2. Mandatory Public Documents

- Public offer agreement (оферта) with subscription terms.
- Privacy policy (политика конфиденциальности).
- Personal data processing policy (политика обработки ПДн).
- Consent forms:
  - consent to personal data processing.
  - consent to marketing/notifications (separate).
- Payment and refund policy (including recurring billing).
- Acceptable Use Policy (AUP).

## 3. Offer (Оферта) Minimum Clauses

- Service definition and access model.
- Subscription billing cycles and automatic renewals.
- User responsibilities and acceptable use.
- Service limitations and SLA disclaimer for internet dependency.
- Refund grounds and procedure timelines.
- Account/device restrictions and suspension conditions.
- Liability limitation and dispute resolution jurisdiction.

## 4. Personal Data (ПДн) Operational Requirements

- Data inventory and mapping:
  - identity/contact data.
  - billing references.
  - device identifiers.
  - security/audit logs.
- Data minimization:
  - no unnecessary traffic content storage.
  - strict retention windows per data class.
- Data subject rights workflow:
  - request intake channel.
  - identity verification before fulfillment.
  - export/delete SLA timeline.

## 5. Contracts with Processors (DPA/Service Agreements)

- Hosting and infrastructure provider contracts.
- Payment providers: YooKassa, CloudPayments, T-Bank.
- Notification providers (email/SMS/push).
- Support tooling and CRM (if used).

Each contract must include:
- data processing purpose,
- security obligations,
- incident notification timelines,
- subprocessor transparency,
- data deletion at termination.

## 6. Payment, Refund, and Chargeback Procedure

- User-facing policy must define:
  - refund windows and conditions,
  - channels to request refund,
  - expected processing time.
- Internal SOP:
  - classify request type (refund/chargeback/fraud),
  - verify payment and subscription history,
  - execute provider action and log audit evidence.
- Mandatory audit entries:
  - who approved,
  - reason code,
  - timestamp and provider reference.

## 7. Incident Response Legal Overlay

- Security incident policy must include:
  - legal owner and communications owner.
  - evidence preservation steps.
  - user notification decision logic.
- Tie operational runbook to:
  - `docs/runbooks/INCIDENT_RESPONSE.md`.
- Preserve legal evidence chain:
  - immutable incident timeline,
  - signed export of relevant logs/events.

## 8. Compliance Artifacts to Maintain

- Versioned repository of all public legal texts.
- Register of processing activities and retention matrix.
- Consent registry with version and timestamp.
- Vendor register with contract expiration reminders.
- Quarterly compliance review minutes and action items.

## 9. Release Gate Before Production

- External legal counsel review completed.
- Offer and privacy documents published and linked in app/site.
- Consent capture events verified in audit logs.
- Refund/chargeback workflow tested in sandbox.
- Incident communication templates approved.

## 10. Practical Templates to Prepare Next

- `LEGAL_OFFER_RU_TEMPLATE.md`
- `LEGAL_PRIVACY_POLICY_RU_TEMPLATE.md`
- `LEGAL_PD_PROCESSING_POLICY_RU_TEMPLATE.md`
- `LEGAL_REFUND_POLICY_RU_TEMPLATE.md`
- `LEGAL_AUP_RU_TEMPLATE.md`
- `LEGAL_INCIDENT_NOTICE_RU_TEMPLATE.md`
