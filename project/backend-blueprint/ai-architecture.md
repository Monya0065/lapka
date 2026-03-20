# AI Architecture: Safety Triage Layer

## 1) Scope
The AI component is restricted to triage support only.

Allowed outputs:
- risk level (GREEN, YELLOW, RED)
- safe actions
- recommendation to visit a veterinarian

Forbidden outputs:
- diagnosis
- drug names
- dosages
- treatment instructions

Every AI response must include this exact sentence:
- "This tool provides triage information only."

## 2) High-Level Components
- **Input Validator**: validates schema for species, age, symptoms, duration, temperature, activity, appetite.
- **Red Flag Detector**: checks emergency signs first.
- **Risk Scorer**: applies weighted score and age multiplier.
- **Safety Response Generator**: outputs only allowed fields.
- **Policy Filter**: blocks forbidden tokens and rewrites unsafe outputs.
- **Audit Logger**: stores prompts, output class, and policy decisions.

## 3) Triage Algorithm
1. Detect red flags.
2. Calculate risk score.
3. Apply age multiplier.
4. Classify urgency.
5. Generate safe response.

### Red Flags (Immediate RED)
- seizures
- unconsciousness
- breathing distress
- severe bleeding
- toxin ingestion
- major trauma

If any red flag is present:
- set `risk = RED`
- show emergency warning
- recommend emergency veterinary visit

## 4) Safety Output Contract
```json
{
  "riskLevel": "GREEN|YELLOW|RED",
  "safeActions": ["string"],
  "recommendation": "string",
  "notice": "This tool provides triage information only."
}
```

## 5) AI Router Model Family Comparison
| model | strength | risk | best use |
|---|---|---|---|
| OpenAI GPT | Strong instruction following, reliable tool orchestration | Medium: can over-elaborate without strict policy filter | Primary triage response generation with guardrails |
| Anthropic Claude | Clear structured writing, long-context reasoning | Medium: may provide broad advisory language if unconstrained | Protocol summarization and documentation drafts |
| Google Gemini | Multimodal pipeline options, broad ecosystem integration | Medium: output style variability across tasks | Intake flows using mixed text/image metadata |
| Mistral | Efficient serving footprint, fast inference | Medium-high: requires tighter prompt constraints | Cost-sensitive fallback triage classification |
| Llama | Self-host control and customization | High: policy consistency depends on deployment tuning | On-prem experiments and internal analytics |

Inference:
- OpenAI GPT is the best default for safety triage generation when combined with deterministic policy filtering and output schema validation.
- Mistral/Llama are suitable fallback routes only if safety filters remain mandatory at the platform layer.

## 6) Router Logic
- Route all triage requests through policy-first gateway.
- If model confidence is low or policy violation is detected, return conservative YELLOW response and prompt veterinary visit.
- Hard fail to RED if red flags are detected by deterministic matcher.

## 7) Logging and Monitoring
- Log: user role, pet id, red flag status, risk output, model used, safety filter actions.
- Alert on: repeated policy violations, sudden spikes in RED rates, model timeout rate increase.
- Keep immutable audit records for compliance and clinical governance.

## 8) Prompt Skeleton
- System: define allowed/forbidden output classes.
- Developer: enforce JSON output schema and required notice.
- User: symptom input context.
- Post-processing: strict parser + forbidden phrase filter + notice injection.
