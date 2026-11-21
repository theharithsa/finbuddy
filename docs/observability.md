# FinBuddy observability

## Browser

`src/lib/operation-monitoring.ts` wraps authentication, expense and budget mutations, household record changes, and bill payments in bounded Classic RUM actions. Household actions use `household.save`, `household.remove`, and `bill.payment`. Failures emit the fixed `finbuddy.operation` custom error key and an allowlisted code. Browser action completion describes the SDK result. No browser event is treated as a durable business event.

RUM requires a FinBuddy-specific Dynatrace CDN tag at build time and browser opt-in. Check masking, consent, replay and the destination tenant before supplying `VITE_FINBUDDY_RUM_URL`. Keep session replay disabled. Use synthetic test accounts to verify capture and the `finbuddy.operation` custom error. The app wrapper omits financial values, account identifiers, URLs, receipt details, search strings and raw exceptions.

## Firebase

The browser writes to Firestore using Firebase Auth and existing owner-scoped rules. When backend telemetry is enabled, `finbuddyExpenseAudit` captures committed changes to expense documents as server-confirmed BizEvents. Its audit span begins after the Firestore commit. The previously deployed `chatWithKautilya` callable has a separate runtime and observability lifecycle.

See the [Firebase data handoff](../skills/service-firebase-data/continuation.md) for verified provider boundaries and [FinOps](../skills/project-finops/SKILL.md) for metered usage. Dynatrace ingestion and provider billable usage require separate evidence.

## REST API

The REST API emits OTLP/HTTP protobuf spans, request logs, and request count and duration metrics as `finbuddy-api` in the `finbuddy` service namespace. Use the registered route template, method and response status to find related signals. Explicit server configuration `FINBUDDY_ENVIRONMENT=prod` or `preprod` determines `deployment.environment.name`; both environments share the Firebase project.

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to the approved Dynatrace OTLP base URL and bind the selected environment's named Secret Manager secret below. Store the full authorization header there. Keep runtime secret bindings separate from the CI observer; production uses the configured MCP credential under the owner's explicit authorization. Existing trace-only deployments can still use `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` and secret-backed `OTEL_EXPORTER_OTLP_TRACES_HEADERS` or `OTEL_EXPORTER_OTLP_HEADERS`. Tokens, owner IDs, request bodies, receipt paths and financial values stay out of custom telemetry.

## Delivery

### Isolated pre-production

FinBuddy pre-production shares Firebase project `finbuddy-2025` and its Auth directory, database, receipt bucket and web configuration with production. Its Hosting target is `preprod`, data root is `preprod/data` and receipt prefix is `preprod/receipts`. Approved test accounts are marked and denied production access. See the [consolidation contract](firebase-consolidation.md).

Build with `npm run build -- --mode preprod`. Supply the pre-production Firebase web app's `VITE_FINBUDDY_PREPROD_API_KEY` and `VITE_FINBUDDY_PREPROD_APP_ID`, the candidate Git SHA in `VITE_RELEASE_REVISION`, and the approved pre-production RUM CDN URL in `VITE_FINBUDDY_RUM_URL`. Keep RUM opt-in and Session Replay disabled. Verify the app's deployment with `scripts/verify-hosting.mjs` and `scripts/verify-api.mjs`.

Use the checked release workflow; its backend step selects `finbuddy-api-preprod` and its Hosting step selects only `hosting:preprod` in `finbuddy-2025`. In the API runtime set `OTEL_EXPORTER_OTLP_ENDPOINT` and `FINBUDDY_BUILD_COMMIT`. Store pre-production ingest authorization in Secret Manager as `FINBUDDY_PREPROD_DT_INGEST_AUTHORIZATION`; production uses `FINBUDDY_DT_INGEST_AUTHORIZATION`. The owner authorised reuse of the configured MCP token for production; verify real ingestion rather than demanding another credential. It needs only traces, logs, metrics and BizEvents ingest. The pre-production Functions scale to zero and are capped at one instance each.

| Signal | Pre-production evidence to query |
| --- | --- |
| Logs and traces | One normalized API route, status and actual trace context from a fresh health or authenticated test request |
| Metrics | `finbuddy.api.requests` and `finbuddy.api.request.duration` for the same route, with delta temporality |
| BizEvents | A committed synthetic expense change captured by the Firestore trigger as `finbuddy.expense.created`, `finbuddy.expense.updated` or `finbuddy.expense.removed` |
| Browser RUM | A consenting synthetic browser session emits a bounded FinBuddy action in the pre-production frontend |

Query the `FinBuddy Pre-Prod` segment in India CS. The expense trigger uses a stable event ID and retries transient delivery failures within one hour. Deduplicate by `event.id` in aggregates. Its trace describes the asynchronous Firestore capture. The original browser write goes through the Firebase SDK. The event excludes account IDs, financial values, notes, and receipt references. Permanently rejected deliveries are reported to Firebase logs with an HTTP status.

Release verification accounts use the reserved `finbuddy-release-<UUID>` UID pattern. Audit events expose only the bounded `test.synthetic` flag derived on the server, never that UID. Exclude `test.synthetic=true` from business adoption aggregates. The disposable, explicitly opted-in browser context uses the fixed native RUM tag `finbuddy-release-verification`; filter it out of household adoption/experience reports. Normal application sessions receive no identity tag from this harness.

### Production delivery

Set the GitHub Actions variable `FINBUDDY_PROD_RUM_URL` to the JavaScript tag URL from the existing production Dynatrace frontend. The main-branch Hosting build passes this value to `VITE_FINBUDDY_RUM_URL`. GitHub Actions records lint, unit, isolated browser, build, and Hosting smoke outcomes and checks the live revision.

For the checked production revision, set `FINBUDDY_ENABLE_BACKEND_TELEMETRY=true`, `OTEL_EXPORTER_OTLP_ENDPOINT` and `FINBUDDY_BUILD_COMMIT` in the API deployment environment. Provision the dedicated secret in the `finbuddy-2025` project before deploying `finbuddy-api:finbuddyApi` and `finbuddy-api:finbuddyExpenseAudit` with `firebase.api.json`. Deploy the API before Hosting promotion. Use the same signal checks in `FinBuddy Production`. Match the deployed commit on backend spans, and use only an isolated synthetic account for any production write probe.

To pause backend telemetry, redeploy the API with the activation flag unset and disable the expense audit trigger through the Firebase release path. To pause browser capture, clear `FINBUDDY_PROD_RUM_URL` and publish a checked Hosting rebuild. Retain the previous Hosting version and API revision for recovery.

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
