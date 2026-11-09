# FinBuddy observability

## Browser

`src/lib/operation-monitoring.ts` wraps authentication and expense or budget mutations in bounded Classic RUM actions. Failures emit the fixed `finbuddy.operation` custom error key and an allowlisted code. Browser action completion describes the SDK result. No browser event is treated as a durable business event.

The release defaults to RUM off. Enable a FinBuddy-specific Classic tag with `VITE_FINBUDDY_RUM_URL` only after checking masking, consent, replay and the destination tenant. The client accepts Dynatrace CDN tags and requires a browser opt-in. Set up `finbuddy.operation` as a custom error and use synthetic test accounts to verify the data. The app wrapper omits financial values, account identifiers, URLs, receipt details, search strings and raw exceptions.

## Firebase

The browser writes to Firestore using Firebase Auth and existing owner-scoped rules. Those writes have no app-owned server span or canonical business event. The active `chatWithKautilya` callable has server-side Dynatrace OTLP secret references. The checked-in historical Functions code does not represent that deployed callable. Treat tenant receipt and correlation as pending until the service is reconciled and a synthetic invocation is independently located.

## Delivery

GitHub Actions records the actual lint, unit, isolated browser, build and Hosting smoke outcomes. The production job verifies the Git revision and asset cache headers from live Hosting. Automated export of GitHub outcomes to Dynatrace requires a trusted metadata-only observer and a confirmed ingestion route. PR checks use no cloud or Dynatrace credentials.

| Journey | Signal | Authority |
| --- | --- | --- |
| Sign in or restore session | Auth operation and Firebase Auth state | Browser and Firebase SDK |
| Save or edit expense | Operation result and persisted read after reload in test | Firestore emulator for tests |
| Browse overview and filter ledger | Browser test and responsive checks | Browser with synthetic data |
| Publish and verify | GitHub jobs, Firebase version, served revision | GitHub and Firebase Hosting |
