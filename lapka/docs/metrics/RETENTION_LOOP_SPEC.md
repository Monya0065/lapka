# Retention Loop Spec

## Goal

Define daily and weekly usage loops that reduce churn.

## Core Loops

- Vet daily loop: appointments -> visit closure -> documentation quality
- Clinic admin loop: flowboard -> staffing -> no-show mitigation
- Platform loop: branch health -> AI governance -> risk alerts

## KPIs

- WAU by role (owner/vet/clinic/platform)
- D30 retention by role
- Repeat appointment rate
- No-show recovery rate
- Churn rate and reactivation rate

## Triggers

- In-app alerts for overdue actions
- Weekly risk digest for clinic admins
- Expansion prompts for multi-branch clinics

## Data Contract

Each KPI must include:

- SQL/source definition
- owner
- refresh cadence
- dashboard location
