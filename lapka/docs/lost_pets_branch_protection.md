# Lost Pets Branch Protection Runbook

This runbook defines branch protection settings required to make Lost Pets quality gates merge-blocking.

## Goal

Ensure pull requests that touch Lost Pets scope cannot be merged until:

- technical smoke gate passes
- PR governance checklist passes
- required owners review critical files

## Required GitHub Settings (main branch)

Configure branch protection for `main` with these minimum options:

1. Require a pull request before merging.
2. Require approvals:
   - at least `1` (recommended `2` for security-sensitive changes).
3. Require review from Code Owners.
4. Require status checks to pass before merging.
5. Include administrators in restrictions (recommended).
6. Dismiss stale approvals when new commits are pushed (recommended).

## Required Status Checks

Mark these checks as required:

- `Lost Pets Smoke / lost-pets-smoke`
- `Lost Pets PR Governance / governance`

Recommended for governance/process changes:

- `Lost Pets Governance Self Check / validate-governance-contract`

If your repository settings display different check names, use the exact job names shown in the PR checks UI.

## CODEOWNERS Dependency

Branch protection relies on `.github/CODEOWNERS`.

- Replace placeholder teams (`@lapka/...`) with real GitHub users/teams.
- Confirm at least one listed owner has write access to the repository.

Without valid owners, Code Owners protection will not behave as intended.

## Validation Procedure

After setup, validate with a test PR:

1. Change a Lost Pets file (for example, `backend/src/api/routes/growth.py`).
2. Open PR without filling checklist items.
3. Confirm:
   - `Lost Pets PR Governance` fails.
   - Code Owner review is requested.
4. Fill checklist and push fix.
5. Confirm:
   - governance passes
   - `Lost Pets Smoke` runs and passes
   - merge remains blocked until required owner review is approved

## Operational Notes

- Keep path filters in `.github/workflows/lost-pets-governance.yml` aligned with actual Lost Pets scope.
- Update CODEOWNERS when Lost Pets files are added/moved.
- Revisit required checks when workflow/job names change.
