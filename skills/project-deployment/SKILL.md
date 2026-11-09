---
name: project-deployment
description: Prepare or verify FinBuddy Hosting, Firebase rules and Functions releases, and the local MCP build.
---

# FinBuddy deployment

Read the [release plan](../../docs/release-plan.md) and the affected service continuation. Verify the target, authorized action, checked Git revision, and rollback source before any provider change.

- Hosting publishes the checked `dist/` artifact through the `main` workflow. Verify the served SHA, cache headers and brand assets. If the first check sees an older revision, retain that CI result and retry the read-only smoke check within a bounded window.
- Rules, indexes and Functions have independent release boundaries. Inspect the [data](../service-firebase-data/SKILL.md) or [Functions](../service-firebase-functions/SKILL.md) handoff before selecting a scoped command. MCP is an operator-run [local build](../service-mcp-server/SKILL.md).
- Track a tag, GitHub merge, provider release and runtime verification separately. Use a new immutable application tag for a new published version and preserve the App Launchpad template version independently.
- Include [FinOps](../project-finops/SKILL.md) when a release changes resource usage, billing or quotas. Confirm rollback through the same runtime smoke check.
