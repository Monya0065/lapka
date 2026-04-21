# Sprint Task Board Template

## Purpose

Provide a sprint-ready board format to convert backlog epics into executable tasks with acceptance tests.

## Sprint Header

- Sprint name:
- Start date:
- End date:
- Sprint owner:
- Review date:

## Capacity

| Team | Available points/hours | Reserved for incidents | Net delivery capacity |
|---|---:|---:|---:|
| Product |  |  |  |
| Engineering |  |  |  |
| QA |  |  |  |
| Security/Ops |  |  |  |

## Epic-to-Task Breakdown

For each backlog epic, define sprint tasks.

| Task ID | Epic | Task | Owner | Deputy | Estimate | Priority | Dependency | Acceptance Test | Status |
|---|---|---|---|---|---:|---|---|---|---|
|  |  |  |  |  |  | P0/P1/P2 |  | explicit test case | todo/in-progress/done |

## Acceptance Test Format (mandatory)

Each task must include testable acceptance criteria:

1. Given <precondition>
2. When <action>
3. Then <expected outcome>

And at least one evidence artifact:

- screenshot/report/log/test output link

## Sprint Risk Board

| Risk | Impact | Likelihood | Owner | Mitigation | Trigger to escalate |
|---|---|---|---|---|---|
|  | low/med/high | low/med/high |  |  |  |

## Mid-Sprint Checkpoint

- Date:
- Completed tasks:
- Slipped tasks:
- Scope change decisions:
- Escalations:

## Sprint Exit

Exit conditions:

- all P0 tasks are `done`
- all `done` tasks have evidence links
- unresolved P1/P2 carry-over has owner and rationale

## Related Documents

- `docs/PHASE2_IMPLEMENTATION_BACKLOG.md`
- `docs/EXECUTION_CALENDAR_RITUALS_AND_OWNERS.md`
