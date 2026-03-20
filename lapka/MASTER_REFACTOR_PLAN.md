# LAPKA Veterinary EMR – Full Refactor Master Plan

## Goal
Transform the existing project into a production-ready veterinary medical platform with clean architecture, responsive UI, robust RBAC, medical file handling, and AI-assisted workflows.

The system must support clinics with multiple doctors, multiple animals per owner, medical imaging files, and AI-assisted documentation.

---

# 1. Global Architecture

Backend:
FastAPI
PostgreSQL
Alembic
Docker

Frontend:
Next.js
React
TypeScript

Architecture principles:

- clear separation of layers
- service layer
- repository pattern
- RBAC middleware
- API versioning
- modular domain structure

Structure:

backend/

core
config
security
logging

modules
auth
users
owners
animals
visits
diagnostics
files
notifications
calendar
ai

services
repositories
schemas

frontend/

components
layout
sidebar
topbar
cards
forms

modules
dashboard
animals
owners
visits
diagnostics
calendar
documents
settings

lib
api
hooks
auth
i18n

---

# 2. UI / UX Refactor

Problems detected:

- small square UI blocks
- long unreadable text blocks
- broken responsive layout
- missing navigation hierarchy
- sidebar incorrectly tied to single animal
- missing home/back navigation

Required UI principles:

- rectangular card layout
- clear visual hierarchy
- responsive grid
- proper spacing
- consistent typography

Use:

- Tailwind grid
- responsive breakpoints
- max-width containers
- card components

Layout structure:

Topbar

logo
clinic selector
language switch
notifications
profile

Sidebar

Dashboard
Owners
Animals
Visits
Diagnostics
Calendar
Documents
Analytics
Settings

Main Content

Cards
Tables
Forms
Imaging viewer

---

# 3. Multi Language System

Required languages:

English
Russian

Implementation:

Next.js i18n

Structure:

/locales/en
/locales/ru

All UI text must use translation keys.

Language switcher in top bar.

---

# 4. Navigation Logic

After login:

User lands on Dashboard.

Top menu includes:

Dashboard
Calendar
Notifications
Search
Profile

Sidebar shows dynamic animals list.

Instead of fixed "Barsik":

Animals list must be dynamic.

Example:

Owner
 ├ Barsik
 ├ Murzik
 ├ Rex
 └ Luna

Selecting animal updates context.

---

# 5. Role Based Access Control

Roles:

Admin
Clinic Owner
Doctor
Assistant
Viewer

Permissions example:

Admin

system settings
user management
billing

Owner

clinic data
all animals
reports

Doctor

visits
diagnostics
files

Assistant

appointments
basic updates

Viewer

read-only

RBAC implemented with middleware.

---

# 6. Medical File System

The system must support:

DICOM
MRI
CT
Ultrasound
X-ray
Images
PDF

Implementation:

object storage

local or S3

Metadata stored in DB.

Viewer:

Web DICOM viewer.

Examples:

OHIF
Cornerstone.js

Features:

zoom
windowing
slices
annotations

Preview available directly in browser.

---

# 7. AI Assisted Features

AI modules:

symptom analysis
protocol filling assistance
medical suggestions
drug information
speech to text notes

AI must support:

photo input
text input
voice input

Example use:

Doctor speaks during visit.

Speech converts to notes.

AI structures protocol.

AI suggests:

diagnosis possibilities
recommended tests
drug information

Sources:

veterinary medical databases
drug databases
guidelines

---

# 8. Calendar System

Interactive calendar required.

Features:

drag appointments
color coded visits
doctor schedule
room schedule
reminders

Suggested library:

FullCalendar

Views:

day
week
month

---

# 9. Notifications

Support:

SMS
Push
Email

Triggers:

appointment reminder
follow-up visit
test results

---

# 10. QR Code System

QR codes for:

animal profile
visit summary
medical records

Use cases:

scan at clinic desk
open record instantly

---

# 11. PDF Export

Generate:

visit protocol
test results
vaccination certificate

Implementation:

HTML → PDF

Libraries:

WeasyPrint
wkhtmltopdf

---

# 12. Production Requirements

Must add:

logging
audit trail
rate limiting
security headers
API versioning

Monitoring:

Sentry
Prometheus

---

# 13. Responsive Design

Must support:

desktop
tablet
mobile

Use:

responsive grids
flex layouts
container widths

---

# 14. Missing Production Features

Add:

backup system
file storage redundancy
access logs
error tracking
data export
GDPR compliance

---

# 15. Refactor Phases

Phase 1

code audit
structure cleanup
UI layout redesign

Phase 2

RBAC
file system
calendar

Phase 3

AI integration
notifications
PDF/QR

Phase 4

production hardening
security
monitoring

---

# 16. Agent Execution Rules

The AI agent must:

analyze the repository
identify architecture problems
apply safe refactors
work in small steps
not ask questions
prioritize stability
