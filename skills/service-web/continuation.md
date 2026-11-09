# FinBuddy web continuation

Inspected `22fdc36bf8e6f7aa2f2a31f9b394dcb04575b115` on 10 November 2026. [PR #112](https://github.com/theharithsa/finbuddy/pull/112) merged the household workspace, isolated demo, shared filled icons, Google profile photo, spending insights, and record edit accessibility and draft fixes. [Issue #111](https://github.com/theharithsa/finbuddy/issues/111) is completed.

- Firebase Hosting serves the merge revision on `finbuddy-2025.web.app`. Version `59d6e65f6a84d2f9` and live release `1794261161186000` identify the artifact. The deploy action succeeded, its first smoke check saw a revision mismatch, and a later read-only smoke check passed. See [release evidence](../../qa/evidence.json).
- The immutable [v3.0.0 tag](https://github.com/theharithsa/finbuddy/tree/v3.0.0) records the earlier production revision `48ce818`, whose Hosting version `5092852b479e2d27` is the preceding rollback candidate.
- The checked web runtime uses Firebase Auth and the existing ledger, budgets, templates and household paths. The demo uses no account SDK. Metrics Explorer and KautilyaAI show Coming soon.
- FinVision remains a planning item. Firebase lists its separate Hosting site under the same project. Verify its client identity and stored data before any integration or migration. Keep the [data](../service-firebase-data/SKILL.md) and [release](../../docs/release-plan.md) boundaries when adding an in-app feature.
