---
name: project-deployment
description: Prepare or verify FinBuddy Hosting, Firebase rules and Functions releases.
---

# FinBuddy deployment

Read the [release plan](../../docs/release-plan.md) and the affected service continuation. Verify the target, authorized action, checked Git revision, and rollback source before any provider change.

- Follow the [release controls](../../docs/release-controls.md): implementation PR → protected `preprod` → isolated deployment/acceptance → promotion PR → protected `main`. Both branches retain zero required independent reviewers. Verify the owner receipt for the exact source/run/attempt before production.
- Hosting publishes the accepted environment-specific artifact; the backend uses the same accepted source. Record its source SHA separately from the production merge SHA. The workflow deploys API/audit prerequisites before Hosting and publishes Pages from the accepted source after live checks.
- Each GitHub environment uses its project-local OIDC release identity and dedicated runtime identity. Read back environment branch restrictions, workload-identity conditions and effective IAM. No cloud credentials belong in PR jobs; the CI observer keeps its separate ingest credential.
- Read the actual GitHub OIDC `sub_claim_prefix` before binding provider trust; this repo uses immutable owner/repository-ID subjects. Keep attempt-specific artifacts and require a full rebuild/acceptance after a workflow rerun. Use the pinned Firebase CLI `15.37.0` for checks and scoped deployments.
- Preserve the previous Hosting/backend versions before rollout, rehearse recovery in pre-production, verify component source and safe denials, and retain non-expiring-token compatibility. Read current receipts in #174/#169 rather than treating a green source merge as runtime acceptance.
- Rules, indexes and Functions have independent release boundaries. Inspect the [data](../service-firebase-data/SKILL.md) or [Functions](../service-firebase-functions/SKILL.md) handoff before selecting a scoped command.
- Track a tag, GitHub merge, provider release and runtime verification separately. Use a new immutable application tag for a new published version and preserve the App Launchpad template version independently.
- Include [FinOps](../project-finops/SKILL.md) when a release changes resource usage, billing or quotas. Confirm rollback through the same runtime smoke check.
