---
name: project-implementation
description: Implement FinBuddy features or fixes through the issue-linked App Launchpad workflow and the applicable service boundaries.
---

# FinBuddy implementation

Start from the checked `main` revision and use the [delivery procedure](../../docs/delivery.md). Use the [catalog](../catalog.json) to find the source owners and read their continuations.

- Trace the active entrypoint before modifying a similarly named legacy component. The [web skill](../service-web/SKILL.md) identifies the account and demo paths.
- Keep the change within the affected service. Use the [data skill](../service-firebase-data/SKILL.md) for ownership, stored values, indexes and receipts. Use the [Functions skill](../service-firebase-functions/SKILL.md) for callable contracts and the [MCP skill](../service-mcp-server/SKILL.md) for the operator adapter.
- Use explicit TypeScript types and handle partial failure, retries and concurrent writes. Reuse existing validators, date helpers and transactional paths. Keep production error reporting within the [observability contract](../../docs/observability.md).
- Update affected service notes and contract links with the code. Run the [applicable tests](../project-testing/SKILL.md) and record checked evidence on the PR.
