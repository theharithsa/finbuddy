# FinBuddy cost inventory

Baseline checked on 10 November 2026. Cloud Billing is enabled for `finbuddy-2025`. The default Firestore database is in `asia-south1`, the receipt bucket is in `US-EAST1`, and Firebase lists the Gen 2 callable in `us-central1`. Firebase Hosting lists both `finbuddy-2025` and `finvision-ai` in the project. These are resource facts. Actual spend, budget amounts, alert recipients and quota thresholds require separate billing evidence.

| Scope | Meter to inspect | Attribution check |
| --- | --- | --- |
| Firebase Hosting | Storage for retained versions and data transfer for live and preview traffic | Separate FinBuddy's site and channel traffic from other sites. Compare asset sizes, CDN usage and retained versions around the release. |
| Firestore | Document and index reads, writes, deletes, storage and network usage | Inspect initial listener results, reconnects, query limits and transactions. The callable can add reads in the same project. |
| Cloud Storage | Receipt bytes, retained data, upload and download operations, and egress | Separate file size, operations and download volume. Verify retention and deleted-object behavior before proposing cleanup. |
| Firebase Auth | Enabled providers, active-user tier, SMS activity if enabled | Verify project features and pricing. A signed-in browser count is a separate measure. |
| Functions Gen 2 and model | Calls, compute time, memory, egress, build artifacts and model usage if requests reach it | Inspect Cloud Run/Functions and model provider meters. A callable inventory entry establishes deployment, while measured calls establish usage. |
| GitHub Actions | Hosted-runner minutes, retained artifacts and caches | Compare PR and main runs, retries and retention in repository billing reports. |
| Dynatrace | RUM sessions and telemetry ingest, retention or query usage under the active agreement | Inspect the confirmed tenant and account. Current code instrumentation alone does not establish ingestion or usage. |

Keep price sheets, credits and alert policies dated. Check [Cloud Billing reports](https://docs.cloud.google.com/billing/docs/how-to/reports), [budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets), [Hosting usage](https://firebase.google.com/docs/hosting/usage-quotas-pricing), [Firestore billing](https://firebase.google.com/docs/firestore/pricing), [Firebase pricing](https://firebase.google.com/pricing), and the [Dynatrace subscription](https://docs.dynatrace.com/docs/manage/account-management) for the reviewed service.
