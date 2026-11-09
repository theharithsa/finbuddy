# FinBuddy observability

## Browser

`src/lib/operation-monitoring.ts` wraps authentication, expense and budget mutations, household record changes, and bill payments in bounded Classic RUM actions. Household actions use `household.save`, `household.remove`, and `bill.payment`. Failures emit the fixed `finbuddy.operation` custom error key and an allowlisted code. Browser action completion describes the SDK result. No browser event is treated as a durable business event.

The release defaults to RUM off. Enable a FinBuddy-specific Classic tag with `VITE_FINBUDDY_RUM_URL` only after checking masking, consent, replay and the destination tenant. The client accepts Dynatrace CDN tags and requires a browser opt-in. Set up `finbuddy.operation` as a custom error and use synthetic test accounts to verify the data. The app wrapper omits financial values, account identifiers, URLs, receipt details, search strings and raw exceptions.

## Firebase

The browser writes to Firestore using Firebase Auth and existing owner-scoped rules. Those writes have no app-owned server span or canonical business event. The KautilyaAI screen shows Coming soon. The previously deployed `chatWithKautilya` callable and its Dynatrace OTLP configuration have a separate lifecycle. Treat callable telemetry as pending reconciliation and independent verification.

See the [Firebase data handoff](../skills/service-firebase-data/continuation.md) for verified provider boundaries and [FinOps](../skills/project-finops/SKILL.md) for metered usage. Dynatrace ingestion and provider billable usage require separate evidence.

## Delivery

GitHub Actions records the actual lint, unit, isolated browser, build and Hosting smoke outcomes. The production job verifies the Git revision and asset cache headers from live Hosting. Automated export of GitHub outcomes to Dynatrace requires a trusted metadata-only observer and a confirmed ingestion route. PR checks use no cloud or Dynatrace credentials.

| Journey | Signal | Authority |
| --- | --- | --- |
| Sign in or restore session | Auth operation and Firebase Auth state | Browser and Firebase SDK |
| Save or edit expense | Operation result and persisted read after reload in test | Firestore emulator for tests |
| Save household records or pay a bill | Operation result, persisted values, and one expense after concurrent submissions | Firestore emulator for tests |
| Browse overview and filter ledger | Browser test and responsive checks | Browser with synthetic data |
| Publish and verify | GitHub jobs, Firebase version, served revision | GitHub and Firebase Hosting |
