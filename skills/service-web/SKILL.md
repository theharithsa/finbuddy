---
name: service-web
description: Maintain the FinBuddy web workspace, Firebase client contracts and Hosting release.
---

# FinBuddy web

Read [continuation](continuation.md), the [release plan](../../docs/release-plan.md) and [observability](../../docs/observability.md).

- Owner is theharithsa. The entrypoint is [main.tsx](../../src/main.tsx).
- Preserve Firebase UIDs, existing owner-scoped paths, legacy expense dates and receipt references.
- Keep browser events free of financial values and identifiers. Use the operation wrapper for bounded outcomes.
- Run the [checks](../../docs/testing.md) with disposable emulator accounts. Verify Hosting by served Git revision.
