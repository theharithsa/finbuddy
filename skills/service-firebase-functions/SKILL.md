---
name: service-firebase-functions
description: Maintain FinBuddy's deployed callable contract and reconcile the historical Firebase Functions source before a scoped release.
---

# FinBuddy Firebase Functions

Read the [continuation](continuation.md) and [observability contract](../../docs/observability.md). Firebase lists `chatWithKautilya` as Gen 2, Node.js 22, in `us-central1`. The active web route shows Coming soon.

- `functions/src/index.ts` is historical. It exports `chatWithGemini` and `getFinancialInsights`, which differ from the current deployed entrypoint. Reconcile the actual deployed implementation, Auth context, input/output types, region and secret names before a Functions release.
- The [historical browser client](https://github.com/theharithsa/finbuddy/blob/v3.0.0/src/components/AIChatPage.tsx) records the prior `chatWithKautilya` request. Verify identity on the server from Firebase Auth before reading account data. Treat submitted content and model output as untrusted.
- Build with `npm --prefix functions run build` after installing the service lockfile. A source build is distinct from an authenticated callable or tenant verification.
- Use [deployment](../project-deployment/SKILL.md), [FinOps](../project-finops/SKILL.md) and the [release plan](../../docs/release-plan.md) for an authorized model or callable change. Keep secret values, finance records and prompts out of logs and telemetry.
