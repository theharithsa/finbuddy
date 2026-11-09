---
name: project-testing
description: Select and run FinBuddy foundation, web, emulator, and callable checks and report their evidence separately.
---

# FinBuddy testing

Use the [test catalog](../../docs/testing.md) and the [service catalog](../catalog.json) to select checks. Run `sh scripts/check.sh` for catalog, skill, evidence and Markdown changes.

| Affected boundary | Verification |
| --- | --- |
| Web | Lint, unit tests and build. Use Playwright against synthetic Firebase emulator accounts for changed journeys. |
| Auth, Firestore or Storage | Exercise the actual emulator entrypoints with the owner, a second account and a signed-out client. Include legacy records, upload rejection and changed query or index shapes. |
| Functions | Build the Functions package. Treat an authenticated callable contract test and deployed runtime evidence as separate checks. |
| Hosting | Verify the exact revision and assets through the [release plan](../../docs/release-plan.md). Record CI and later runtime results separately. |

Use the fixture project `demo-finbuddy` for writes. The [test catalog](../../docs/testing.md) gives the pinned emulator invocation and runtime prerequisites. Record failed, blocked and skipped checks with their reasons.
