# FinBuddy pre-production and production plan

Reviewed on 20 November 2026 against GitHub, the live Firebase sites and read-only Google Cloud resource metadata. [Planning issue #171](https://github.com/theharithsa/finbuddy/issues/171) owns this review. Implementation and runtime acceptance remain in their linked issues. Dates below are planning targets in Asia/Kolkata; a failed prerequisite moves the dependent target.

This file preserves the planning baseline before implementation. Use the [release-control guide](release-controls.md) and the linked delivery issues for the subsequent workflow, provider releases and acceptance receipts; the gap and backlog snapshots below are historical.

## What is deployed

| Boundary | Pre-production | Production |
| --- | --- | --- |
| Firebase project | `finbuddy-preprod` | `finbuddy-2025` |
| Hosting | [Pre-production app](https://finbuddy-preprod.web.app/) | [Production app](https://finbuddy-2025.web.app/) |
| Served web source | `dfb1d5fbb427fc128de309b7444ef58a0eb83468` | `e1b68144caf0917144e82360a185c8ddda129869` |
| REST API | `finbuddyApi`, Node 22, `asia-south1`, revision `finbuddyapi-00003-sad` | `finbuddyApi`, Node 22, `asia-south1`, revision `finbuddyapi-00003-fac` |
| API build source | `d5de7578f0f1ee5bb3ea304cc346dd7412488593` in deployment configuration | No build-source identifier in inspected deployment configuration |
| Expense audit trigger | `finbuddyExpenseAudit`, revision `finbuddyexpenseaudit-00002-xuv` | No expense-audit function in the inspected `asia-south1` inventory |
| Firestore | Separate native `(default)` database in `asia-south1` | Native `(default)` database in `asia-south1` |
| Ingest credential | `FINBUDDY_DT_INGEST_AUTHORIZATION` binding exists | Secret and API binding absent |
| Public API probes | `/api/v1/health` → 200; unsigned `/api/v1/profile` → 401 | `/api/v1/health` → 200; unsigned `/api/v1/profile` → 401 |

Pre-production exists and is usable. Its web and API sources currently differ, so the next release needs one integrated candidate rehearsal. Separate projects and databases alone do not establish effective IAM, Auth or Storage isolation; the negative tests in #174 must prove those boundaries. No household records or secret values were read for this review.

## Delivery gaps to resolve first

The checked `main` source is `e1b68144caf0917144e82360a185c8ddda129869`. Its [workflow](../.github/workflows/finbuddy.yml) runs `foundation`, `verify` and `verify-api`, then releases Hosting from a push to `main`. Pages follows successful Hosting checks. API and rules deployments have separate procedures. This workflow does not enforce hosted pre-production acceptance or deploy the expense-audit prerequisite.

[PR #170](https://github.com/theharithsa/finbuddy/pull/170) contains the isolated pre-production configuration and production observability candidate at `d5de7578f0f1ee5bb3ea304cc346dd7412488593`. It still targets `main`. Its earlier probe results are useful historical evidence; refresh them for the final integrated candidate after dependencies or release controls change.

GitHub has no pre-production deployment environment or staging branch for this release path. The old `feature/3.0.0` branch dates to September 2025 and is unsuitable as its starting point. [Issue #172](https://github.com/theharithsa/finbuddy/issues/172) establishes the staging role from current `main`, reuses the existing Firebase project and reconciles #170 without prematurely activating production. It also owns updates to the relevant deployment and service continuations.

## Ordered work and target windows

| Order | Work and tracked items | Pre-production exit | Production exit / target |
| --- | --- | --- | --- |
| 1 | [Release controls #172](https://github.com/theharithsa/finbuddy/issues/172) | Checked staging deployment; isolated identity/configuration; missing, stale, wrong-source or failed acceptance blocks promotion | Controls demonstrated before the next product promotion; target 29 November |
| 2 | [Dependency assessment #173](https://github.com/theharithsa/finbuddy/issues/173) and PRs [#164](https://github.com/theharithsa/finbuddy/pull/164), [#165](https://github.com/theharithsa/finbuddy/pull/165), [#166](https://github.com/theharithsa/finbuddy/pull/166), [#167](https://github.com/theharithsa/finbuddy/pull/167), [#168](https://github.com/theharithsa/finbuddy/pull/168) | Refresh candidate, validate affected packages, classify remaining alerts by actual exposure and remediate applicable findings | Roll forward the accepted source through promotion; assessment and applicable remediation target 29 November |
| 3 | [Integrated rehearsal #174](https://github.com/theharithsa/finbuddy/issues/174), blocked by #172 and #173 | Web/API/audit candidate, household flows, access denials, fresh telemetry and recoverable service versions all recorded | Acceptance receipt required for #169; target 29 November |
| 4 | [Production observability #169](https://github.com/theharithsa/finbuddy/issues/169) / [PR #170](https://github.com/theharithsa/finbuddy/pull/170), blocked by #174 | Final integrated source accepted; provision production-specific ingest binding through an authorized secret channel | Deploy affected API/audit and Hosting; verify fresh signals, protected-route denial and synthetic cleanup; conditional target 4 December |
| 5 | [FinVision discovery #125](https://github.com/theharithsa/finbuddy/issues/125), ordered [#141](https://github.com/theharithsa/finbuddy/issues/141) → [#142](https://github.com/theharithsa/finbuddy/issues/142) → [#143](https://github.com/theharithsa/finbuddy/issues/143) | Discovery defines identity, ownership, first page, sync and failure/recovery contract; subsequent implementation gets its own pre-production pilot | Discovery target 13 December; estimate and schedule implementation and production pilot after the contract is accepted |
| 6 | [Replacement MCP scope #126](https://github.com/theharithsa/finbuddy/issues/126) | Plan a small read-only API-backed slice; synthetic token scope/revocation and account-isolation verification before its pilot | Backlog until prioritized after the release path and FinVision contract; no production date assigned |

Release-control and dependency assessment work can proceed together. FinVision discovery can also proceed without waiting for a production telemetry release. A FinVision implementation or migration cannot be inferred from completing the discovery issues.

The dependency snapshot has 22 open security alerts: 1 critical, 11 high, 6 medium and 4 low. Twenty-one reference the historical `functions/package-lock.json`, and one references the root lockfile. The five update PRs do not cover the full inventory. #173 determines shipped runtime, build-tool and historical-source exposure using the authorized security view, and records applicable fixes or an explicit owner decision on residual risk. Do not publish exploit details in this public plan.

PRs #164–#166 affect the historical `/functions` package and need its build checked. Those source updates do not authorize deploying the old callable entrypoints over the currently deployed service. PR #167 changes lint globals across a major version and needs Node/ESLint compatibility checked. PR #168 needs progress component and affected household UI checks. Re-run required checks on the latest combined candidate after each source change.

## Promotion contract to implement in #172

1. Link the implementation issue and PR to the primary Project and outcome milestone. Use the staging branch for implementation, checked deployment and acceptance, followed by a promotion PR to `main`. Keep zero required independent approvals for this solo-maintainer repository and retain real CI checks. Separately authorize any access or protection changes.
2. Build from lockfiles and run the applicable foundation, web, API and dependency checks. Keep untrusted PR execution separate from privileged deployment and ingestion credentials. Pin third-party actions, use explicit Firebase project targets, bounded concurrency/timeouts and the dt-obs Thoth workflow instrumentation.
3. Reuse `finbuddy-preprod` and its separate Auth, Firestore, Storage and secret configuration. Verify effective service-account permissions and negative access cases. Use synthetic accounts and fixtures; do not copy production household data. A staging deployment must not trigger production publication.
4. Record the candidate source, CI run and attempt, lockfile identities, Hosting artifact digest/version, API and audit build/revisions, rules/index versions and environment configuration references. Browser builds necessarily contain environment-specific Firebase configuration; record both artifact identities and verify their common accepted source. Never include credentials in the receipt.
5. Make acceptance a required promotion check. A missing receipt, a failed required test, an unexpected project, changed source or untested promotion result must fail closed. Verify the promotion merge result against the tested content; if it changes deployable content, rehearse the resulting candidate again. The implementation issue must demonstrate these rejection cases before calling the control enforced.
6. For the authorized production release, deploy API/audit prerequisites and any required indexes/rules before dependent Hosting queries or rewrites. Verify the final provider releases and served source, then publish Pages for the accepted production revision. Check public documentation publication separately.

This is the intended operating contract. The controls remain pending until #172 is implemented and its rejection tests pass. The current `main` workflow still publishes production Hosting on a qualifying push.

## Acceptance receipt for #174 and #169

| Evidence | Pre-production rehearsal | Production verification |
| --- | --- | --- |
| Candidate | Checked source/content identity, CI run/attempt, build digests and deployment project | Accepted promotion result; environment-specific artifact and actual provider release identities |
| Household journeys | Sign-in/out and Google photo; overview totals; expense add/edit/delete; accounts/categories/bills; receipts; preferences; Developer options and Swagger at desktop/mobile widths | Bounded smoke with a dedicated synthetic account for the affected journeys; no real household writes |
| Access boundaries | Signed-out and second-account denial; invalid, expired and revoked tokens; receipt isolation; effective IAM and production-resource denials | Public health and unsigned protected-route denial; authorized synthetic token smoke |
| Telemetry | Fresh RUM action, API log, metric, trace and committed-expense event in the pre-production segment; safe markers and event deduplication | Fresh evidence for each signal in the production segment with the deployed revision; fixture cleanup receipt |
| Privacy | Browser analytics opt-in, replay disabled, identifying/financial fields excluded | Same controls verified on the production candidate |
| Recovery | Previous compatible web/API/audit/rules configuration identified; component recovery rehearsed; fixtures cleaned | Record actual recovery versions and a bounded post-release observation result; execute recovery if release checks fail |

Attach timestamps, safe probe markers, query/run links and explicit pass/fail/pending results to the owning issue. The earlier health probes demonstrate only reachability and unsigned denial. No current browser-flow, IAM-isolation or fresh Dynatrace acceptance is claimed by this planning review.

Rollback must address Hosting and affected backend revisions separately. A web revert does not restore API, audit, rules, indexes or data. Preserve compatibility with non-expiring tokens (`expiresAt: null`), and never perform destructive automatic household-data rollback. Re-verify the restored source, health, denial and affected journey after recovery. Follow the [service-specific recovery guide](release-plan.md).

## GitHub planning state and remaining scheduling edits

All reviewed work keeps the [public FinBuddy Project](https://github.com/users/theharithsa/projects/1) as its primary board. New tasks are typed and assigned to `theharithsa`. Native issue dependencies enforce #172 + #173 → #174 → #169; the existing FinVision dependencies remain #141 → #142 → #143.

The dated outcome milestones are [Pre-production release readiness](https://github.com/theharithsa/finbuddy/milestone/13) on 29 November, [Production observability release](https://github.com/theharithsa/finbuddy/milestone/14) on 4 December, and [FinVision integration discovery](https://github.com/theharithsa/finbuddy/milestone/4) on 13 December. The rolling Dependency maintenance milestone retains its update PRs and #173. #126 remains in Backlog triage.

The public Sprint planning view was inspected. Sprint 1 runs 16–29 November and Sprint 2 runs 30 November–13 December 2026. At review, #169 was Todo in Sprint 1; #125 and #126 were In Progress in Sprint 2; all six existing open PRs had no Sprint. The available CLI token lacks Project access, and the browser is signed out, so the following Project field changes are pending. Milestones, ownership, bodies and native dependencies were updated through the repository API.

| Project field edit still needed | Desired state |
| --- | --- |
| #172, #173, #174 and PRs #164–#168 | Sprint 1; Todo until work actually starts |
| #169 and PR #170 | Sprint 2; Todo/blocked on #174 until acceptance |
| #125 and children #141–#143 | Sprint 2, with each child imported/visible; set In Progress only for work underway |
| #126 | Todo, no Sprint until prioritized |
| Planning issue #171 and its documentation PR | Sprint 1; planning work In Progress until its documentation is accepted |

Repository timeline receipts confirm Project-add events for #171–#174 and FinVision children #141–#143; the public #171 issue also shows membership in the primary FinBuddy Project. Use the existing [Sprint planning](https://github.com/users/theharithsa/projects/1/views/2), [Roadmap](https://github.com/users/theharithsa/projects/1/views/4) and [Kanban](https://github.com/users/theharithsa/projects/1/views/5) views to finish and verify the saved iteration/status edits and post a short Project status update when write access is available. Verify the documentation PR's membership after opening it. Until those field edits are confirmed, this plan and the repository milestones carry the intended sequence, and the Project still has the scheduling differences listed above.

## Evidence and policy references

- Repository source, branch and PR metadata; current required rules; public Project Sprint planning; open issues, milestones and security alert counts were inspected on 20 November 2026.
- Read-only Firebase project metadata, Cloud Functions descriptions and Firestore database metadata established the environment identities above. HTTP checks read the served `source-revision` tag and the two public API probe responses. Credential checks inspected binding names and secret existence only.
- [App Launchpad delivery path](../.agents/skills/app-launchpad/references/github-release.md#choose-the-delivery-path) and [Project tracking](../.agents/skills/app-launchpad/references/github-projects.md) govern implementation and promotion.
- [Firebase environment guidance](https://firebase.google.com/docs/projects/dev-workflows/overview-environments), [GitHub deployment controls](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments) and [Projects best practices](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/best-practices-for-projects) support the planned isolation, release controls and dependency tracking.
