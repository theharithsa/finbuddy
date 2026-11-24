---
name: service-web
description: Maintain FinBuddy's React workspace, account and demo entrypoints, and Firebase Hosting artifact.
---

# FinBuddy web

Read the [continuation](continuation.md), [design](../../docs/design.md), and [release plan](../../docs/release-plan.md). The web service uses React, Vite and TypeScript with `src/main.tsx` and `src/App.tsx` as entrypoints.

- The static homepage at `/` leads to `/signin`, `/app?demo=1` and `/finvision?demo=1`. Vite and Firebase map only the application routes to `app.html`. Keep old homepage deep links and return a real HTTP 404 for missing routes.
- `AccountApp.tsx` owns the signed-in workspace and sign-in view. `DemoWorkspace.tsx` is lazy-loaded separately and uses synthetic data. Keep the demo independent of account Firebase requests.
- Keep FinVision reachable from Home, Savings and More. Use the shared forecast for the signed-in dashboard, the public demo and the deposit preview. Verify saved and estimated balances independently at desktop and phone widths.
- Reuse the Material 3 styles, shared filled glyphs, device-local appearance provider, and accessible dialog patterns. Preserve Google account photos and the initials fallback.
- Keep Preferences as the first Settings view. Developer Options uses the same section navigation for signed-in accounts, with the token form mounted only while that view is open. The demo shows Preferences without token requests.
- Use the [Firebase data skill](../service-firebase-data/SKILL.md) for identity, stored records and receipts. The Kautilya route currently shows Coming soon. Inspect the live route before changing a historical component.
- Run the [web checks](../../docs/testing.md) and use the served SHA and asset verifier for Hosting. Review listener or payload growth with [FinOps](../project-finops/SKILL.md) before changing resource usage.
