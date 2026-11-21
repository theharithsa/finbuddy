# One Firebase project, two FinBuddy environments

The owner selected this layout on 22 November 2026 in [#184](https://github.com/theharithsa/finbuddy/issues/184). It supersedes the earlier two-project release plan. Keep one FinBuddy application repository and two long-lived branches: `preprod` for rehearsal, then `main` for an accepted production release.

| Resource | Production | Pre-production |
| --- | --- | --- |
| Firebase project | `finbuddy-2025` | `finbuddy-2025` |
| Hosting target | `prod` | `preprod` |
| Site | `finbuddy-2025` | `finbuddy-2025-preprod` |
| Firestore root | `prod/data` | `preprod/data` |
| Private records | `prod/data/users/{uid}/…` | `preprod/data/users/{uid}/…` |
| Receipt objects | `prod/receipts/{uid}/…` | `preprod/receipts/{uid}/…` |
| API | `finbuddyApi` | `finbuddyApiPreprod` |
| Expense audit | `finbuddyExpenseAudit` | `finbuddyExpenseAuditPreprod` |
| Runtime identity | `finbuddy-runtime-prod` | `finbuddy-runtime-preprod` |
| Ingest secret | `FINBUDDY_DT_INGEST_AUTHORIZATION` | `FINBUDDY_PREPROD_DT_INGEST_AUTHORIZATION` |

`prod` and `preprod` are Firestore collections. Each contains a fixed `data` document that anchors the existing collection structure; the financial document IDs and amount types remain unchanged. Developer-token hashes, token lists and idempotency records move with their environment. An existing production API token must continue to work only against production.

## Shared identity and boundaries

Both sites use the existing Firebase web configuration and Auth directory. Existing UIDs, Google profile photos and providers are preserved. Approved pre-production accounts need the `finbuddyPreprodAccess: true` custom claim. Synthetic accounts also have `finbuddyEnvironment: preprod`, which denies them entry to production and FinVision. A normal production user is not automatically approved for pre-production. Claim changes must merge existing claims.

Rules verify both environment access and record ownership. The API selects its namespace from explicit server configuration, not a request parameter; missing or invalid live configuration stops startup. Receipt downloads verify the selected environment, owner, bucket and path. Test accounts cannot cross the client/API boundaries.

This is a shared-project model: Firestore Admin SDK credentials bypass client rules, and Firestore IAM does not isolate these two collection roots. Backend IAM, Auth administration, quotas and billing share a project. Do not report the earlier cross-project IAM denials as evidence for this architecture. Protect deployment branches and WIF subjects, select exact backend/Hosting targets, and test the application boundaries. The existing bucket has fine-grained access; no uniform-bucket conversion is part of this change.

## FinVision remains in place

The owner explicitly chose to preserve FinVision. Its `finvision-ai` Hosting site and `Users`/`SyncCodes` collections stay in this project. The shared rules preserve its owner and linked-partner behavior while excluding synthetic pre-production identities. FinVision is not copied into either FinBuddy environment or redeployed by this workflow. Consequently the project's total Hosting-site count includes FinVision in addition to FinBuddy's two targets.

## Deployment sequence

1. Run source, migration and emulator/browser checks. Produce both web artifacts from the same checked commit. The schema-2 candidate receipt pins the shared project, pre-production site and both namespace roots; old two-project receipts are rejected.
2. Use `firebase.transition.json` to release reviewed transitional rules. They retain owner-only legacy production access during the migration, preserve FinVision and permit the new environment paths. Record source digests and read back both policies. Never use a broad compatibility permission.
3. Deploy only pre-production's backend codebase and `hosting:preprod`. The release script checks policy parity, environment identity, deployed revision and 100% serving traffic before Hosting. Exercise synthetic data, token lifecycle, owner/cross-user denials, production-client denials, both viewports and fresh telemetry.
4. Take a private typed snapshot of the four FinBuddy legacy roots: `users`, `publicCategories`, `finbuddyDeveloper`, `finbuddyApiTokens`. Exclude FinVision. Reconcile and checksum-copy receipt objects into owner folders; retain unmatched objects under inaccessible `prod/recovery/receipts`. Keep original bytes and fresh download capabilities separate.
5. Copy the reviewed financial plan into `prod/data`. The tool preserves typed values and IDs, rewrites internal references and reviewed receipt links, refuses unrelated destination writes, and records resumable progress. Verify every destination and the complete unchanged source set.
6. Fence legacy writes for the final reconciliation window, then release strict `firestore.rules` and `storage.rules`. Keep FinVision's permissions. A strict-policy release is independent from application deployment; production deployment rejects transitional policy.
7. Grant exact-source acceptance only after the final checks pass. Merge `preprod` into `main`; deploy compatible API/audit before the accepted `hosting:prod` artifact. Verify production synthetics, existing-token compatibility, owner receipts, source markers and all telemetry signals. Record actual outcomes in #184 and #174.
8. Retire legacy receipt download capabilities only after verified cutover. Retain private recovery manifests and original file bytes. Retire the obsolete `finbuddy-preprod` project only after its empty-data inventory, the new deployment and recovery checks pass. Do not delete FinVision, Auth users or unrelated legacy services.

## Migration tools

Manifests contain private household data and receipt capabilities. Keep them outside the repository, CI artifacts, telemetry and public issue attachments. The scripts print bounded counts only. Supply an absolute private path and an explicit project acknowledgement for writes.

```powershell
node scripts/migrate-environments.mts --mode=snapshot --project=finbuddy-2025 --environment=prod --manifest=C:\Private\FinBuddy\snapshot.json
node scripts/migrate-receipts.mts --mode=plan --snapshot=C:\Private\FinBuddy\snapshot.json --manifest=C:\Private\FinBuddy\receipts.json
node scripts/migrate-receipts.mts --mode=copy --ack-project=finbuddy-2025 --manifest=C:\Private\FinBuddy\receipts.json
node scripts/migrate-environments.mts --mode=snapshot --project=finbuddy-2025 --environment=prod --receipt-map=C:\Private\FinBuddy\receipts.json.urls.json --manifest=C:\Private\FinBuddy\final-snapshot.json
node scripts/migrate-environments.mts --mode=copy --project=finbuddy-2025 --environment=prod --ack-project=finbuddy-2025 --manifest=C:\Private\FinBuddy\final-snapshot.json
node scripts/migrate-environments.mts --mode=verify --project=finbuddy-2025 --environment=prod --ack-project=finbuddy-2025 --manifest=C:\Private\FinBuddy\final-snapshot.json
```

Use Google ADC in the operator's environment; never paste a credential into these commands. A changed source, checksum, owner, destination or policy blocks cutover. A second copy of the same plan resumes safely. If a new snapshot is needed, preserve the original progress receipt so the tool can distinguish its own unchanged copies from customer writes.

## Recovery limits

Before cutover, original financial documents and files remain unchanged. Preserve preceding Hosting/backend revisions and exact deployed policy sources. After new production writes begin, reverting to the old schema can hide those writes; use a reviewed reverse reconciliation or fix forward. Never restore permissive policy to recover a UI. The private export is evidence for this migration, not an automatic Firestore backup schedule or a demonstrated customer-data restore.

GitHub owns merge and check results; Firebase owns provider releases; test runners own scenario outcomes; Dynatrace owns searchable signals. A source merge, a copy, an accepted release, a deployed site and a retired project are separate states.
