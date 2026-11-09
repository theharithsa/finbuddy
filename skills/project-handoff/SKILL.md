---
name: project-handoff
description: Resume FinBuddy work or leave a verifiable handoff for the next session across source, services, and releases.
---

# FinBuddy handoff

Read the [catalog](../catalog.json), the affected service continuations and [release evidence](../../qa/evidence.json). Verify the remote branch, current PR or issue, and provider state if they affect the next action.

- Record the inspected Git SHA, current issue/PR, service contracts, verified checks and unresolved decisions. Use [the evidence policy](../../.agents/skills/app-launchpad/references/evidence.md) to distinguish a deployed artifact from a passing smoke check.
- Keep the current production SHA, rollback version and application tag distinct. Identify pending work by service and say which checks still require a credential, approval, or fixture.
- Record new work as an accepted, proposed, or pending decision. FinVision remains a planning item in the web boundary. Update its handoff when the data and migration design is accepted.
- Recheck catalog pointers and links, including renamed repositories. Keep secret values and private data out of handoffs.
