---
name: service-api
description: Maintain FinBuddy's owner-scoped REST API, personal API tokens, Swagger contract, and isolated Firebase release.
---

# FinBuddy REST API

Read the [continuation](continuation.md), [API guide](../../docs/api.md), and [release plan](../../docs/release-plan.md). The Node.js 22 Gen 2 HTTP function is `api/src/index.ts` in the `finbuddy-api` Firebase codebase. Use [its own Firebase configuration](../../firebase.api.json) for deployment and emulator tests. Hosting rewrites `/api/v1/**` to the deployed function.

- Derive the owner UID from the validated credential. Admin SDK calls bypass Firestore rules, so use only the owned collection for data requests. Keep `finbuddyApiTokens` and `finbuddyDeveloper` outside the browser-owned data tree.
- Store the verifier hash and token metadata. Only return the raw credential on successful issuance. Keep private responses uncached and accept Firebase ID tokens only at the Developer Options routes.
- Keep write validators, operation routing, and Swagger schemas aligned. Use the shared household transaction for bill payments and the create transaction's idempotency record for retries.
- Protect receipt references with the owner prefix, configured bucket, and response size cap. Do not fetch arbitrary receipt URLs or return their download tokens.
- Use the isolated Auth, Firestore, Functions and Storage emulators. Keep optional OTel resource identity `finbuddy-api` and emit only the registered route, method and status.
