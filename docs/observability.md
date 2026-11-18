# FinBuddy observability

## Browser

`src/lib/operation-monitoring.ts` wraps authentication, expense and budget mutations, household record changes, and bill payments in bounded Classic RUM actions. Household actions use `household.save`, `household.remove`, and `bill.payment`. Failures emit the fixed `finbuddy.operation` custom error key and an allowlisted code. Browser action completion describes the SDK result. No browser event is treated as a durable business event.

The release defaults to RUM off. Enable a FinBuddy-specific Classic tag with `VITE_FINBUDDY_RUM_URL` only after checking masking, consent, replay and the destination tenant. The client accepts Dynatrace CDN tags and requires a browser opt-in. Set up `finbuddy.operation` as a custom error and use synthetic test accounts to verify the data. The app wrapper omits financial values, account identifiers, URLs, receipt details, search strings and raw exceptions.

## Firebase

The browser writes to Firestore using Firebase Auth and existing owner-scoped rules. Those writes have no app-owned server span or canonical business event. The KautilyaAI screen shows Coming soon. The previously deployed `chatWithKautilya` callable and its Dynatrace OTLP configuration have a separate lifecycle. Treat callable telemetry as pending reconciliation and independent verification.

See the [Firebase data handoff](../skills/service-firebase-data/continuation.md) for verified provider boundaries and [FinOps](../skills/project-finops/SKILL.md) for metered usage. Dynatrace ingestion and provider billable usage require separate evidence.

## REST API

The REST API emits OTLP/HTTP protobuf spans as `finbuddy-api` in the `finbuddy` service namespace. Spans use the registered route template, method, and response status. Set `FINBUDDY_DEPLOYMENT_ENVIRONMENT` to `production` or `pre-production` on the API runtime so traces match the corresponding Dynatrace segment.

The exporter needs the Dynatrace OTLP base URL in `OTEL_EXPORTER_OTLP_ENDPOINT` and secret-backed `OTEL_EXPORTER_OTLP_HEADERS` on the deployed API. Use `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` for a full traces URL and `OTEL_EXPORTER_OTLP_TRACES_HEADERS` for traces-specific headers. A GitHub Actions variable applies only when the deployment passes it to the runtime. Keep the runtime ingest credential separate from the CI observer and verify a tagged trace in Grail after deployment. Structured function errors contain a fixed message and operation name. Tokens, owner IDs, request bodies, receipt paths and financial values stay out of custom telemetry.

## Delivery

### Isolated pre-production

FinBuddy pre-production runs in the Firebase project `finbuddy-preprod`. It uses a separate Auth user directory, Firestore database, receipt bucket, Firebase web app and Hosting site. Use synthetic records and admin-provisioned test accounts. The pre-production build displays its environment and uses its own Firebase app configuration.

Build with `npm run build -- --mode preprod`. Supply the pre-production Firebase web app's `VITE_FINBUDDY_PREPROD_API_KEY` and `VITE_FINBUDDY_PREPROD_APP_ID`, the candidate Git SHA in `VITE_RELEASE_REVISION`, and the approved pre-production RUM CDN URL in `VITE_FINBUDDY_RUM_URL`. Keep RUM opt-in and Session Replay disabled. Verify the app's deployment with `scripts/verify-hosting.mjs` and `scripts/verify-api.mjs`.

Deploy with `firebase deploy --project finbuddy-preprod --config firebase.preprod.json`. In the API runtime set `OTEL_EXPORTER_OTLP_ENDPOINT` and `FINBUDDY_BUILD_COMMIT`. Store the dedicated ingest authorization header in Firebase Secret Manager as `FINBUDDY_DT_INGEST_AUTHORIZATION`. It needs only traces, logs, metrics and BizEvents ingest. The pre-production Functions scale to zero and are capped at one instance each.

| Signal | Pre-production evidence to query |
| --- | --- |
| Logs and traces | One normalized API route, status and actual trace context from a fresh health or authenticated test request |
| Metrics | `finbuddy.api.requests` and `finbuddy.api.request.duration` for the same route, with delta temporality |
| BizEvents | A committed synthetic expense change captured by the Firestore trigger as `finbuddy.expense.created`, `finbuddy.expense.updated` or `finbuddy.expense.removed` |
| Browser RUM | A consenting synthetic browser session emits a bounded FinBuddy action in the pre-production frontend |

Query the `FinBuddy Pre-Prod` segment in India CS. The expense trigger uses a stable event ID and retries transient delivery failures within one hour. Deduplicate by `event.id` in aggregates. Its trace describes the asynchronous Firestore capture. The original browser write goes through the Firebase SDK. The event excludes account IDs, financial values, notes, and receipt references. Permanently rejected deliveries are reported to Firebase logs with an HTTP status.

### Production delivery

GitHub Actions records lint, unit, isolated browser, build, and Hosting smoke outcomes. The production job verifies the Git revision and asset cache headers from live Hosting.

The [Dynatrace CI observer](../.github/workflows/dynatrace-ci.yml) uses [Thoth v5.67.0](https://github.com/plengauer/Thoth/releases/tag/v5.67.0) to export workflow, job, and step spans plus count and duration metrics as `finbuddy-ci`. It observes completed `push` runs on `main` from this repository for **FinBuddy checks and Hosting** and **Foundation checks**, including failures. Thoth reads GitHub logs to reconstruct timing, with OTLP log export and debug output disabled. It uses a read-only Actions token in a separate job. The Dynatrace ingest secret is referenced only by the observer.

### Enable and verify CI export

1. In [FinBuddy Actions settings](https://github.com/theharithsa/finbuddy/settings/secrets/actions), add `DYNATRACE_OTLP_TOKEN` as a secret. Use a Dynatrace Platform Token with `openpipeline:traces:ingest` and `openpipeline:metrics:ingest`.
2. Set the repository Actions variable `DYNATRACE_OTLP_ENDPOINT` to the approved `https://<environment-id>.live.dynatrace.com/api/v2/otlp` base URL. The observer skips export while the variable is empty. See the [Dynatrace OTLP API docs](https://docs.dynatrace.com/docs/ingest-from/opentelemetry/otlp-api).
3. After the observer reaches `main`, use the next ordinary `main` workflow run. Match its GitHub run ID, attempt, and revision against spans for `finbuddy-ci`. Verify points for `github.actions.workflows` and `github.actions.jobs` in the same time window, then record the run and tenant evidence. A successful observer run alone does not establish ingestion.

Remove the endpoint variable to pause export. Retry the observer only for a diagnosed delivery failure. A replay can duplicate spans and metrics. Thoth's step spans describe workflow execution. Individual test results and release events require their own structured sources. The [Foundation observer smoke](https://github.com/theharithsa/finbuddy/actions/runs/42757480489/attempts/2) was verified in Dynatrace with workflow spans and workflow and job count points.

| Journey | Signal | Authority |
| --- | --- | --- |
| Sign in or restore session | Auth operation and Firebase Auth state | Browser and Firebase SDK |
| Save or edit expense | Operation result and persisted read after reload in test | Firestore emulator for tests |
| Save household records or pay a bill | Operation result, persisted values, and one expense after concurrent submissions | Firestore emulator for tests |
| Browse overview and filter ledger | Browser test and responsive checks | Browser with synthetic data |
| Publish and verify | GitHub jobs, Firebase version, served revision | GitHub and Firebase Hosting |
