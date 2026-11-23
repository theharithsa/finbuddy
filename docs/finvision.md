# FinVision personal planning pilot

Open **More → FinVision** or **Savings → Plan a goal**. A new goal needs a name, its target amount in future rupees and its target month. A family can assign some or all of a holding. Recorded balances drive progress and a planned SIP remains a schedule. See the [first-time walkthrough](https://theharithsa.github.io/finbuddy/docs/product.html#plan-a-goal) or [try the sample](https://finbuddy-2025.web.app/finvision?demo=1).

## Ownership and migration

The API derives the owner from Firebase Auth or a scoped private token. Only the signed-in owner can preview and commit adoption. Production reads the owner's working document under `Users/{uid}/FinVision/data/Personal_Details/profile` or one chosen `Financial_Plans/{id}` scenario. Staging reads synthetic source documents under `preprod/data/finvisionFixtures/{uid}`. Both save the canonical plan in `{environment}/data/finvisionPlans/{uid}`. Partner records, sync codes, AI summaries, expenses and posted income are outside the import.

Preview shows the original cost, base year, assumed inflation and December for year-only targets. Unresolved SIP links require an explicit choice. Invalid values or a source change block the transfer. A transaction checks the reviewed source, claims a pilot seat, writes the plan and records the original reviewed plan and a stable receipt in its private history. A confirmation replay returns the current plan.

Both legacy profile write rules protect the two adopted arrays. Other legacy inputs and named scenarios continue to work. Individual projections on the [standalone site](https://finvision-ai.web.app/) refresh when it regains focus. A projection outage is visible there. Editing stays in FinBuddy. New personal data is excluded from the legacy household, AI and export flows.

## Release and recovery

1. Run the API contracts, strict and transition emulator suites and desktop/mobile browser tests. Promote through the existing [release controls](release-controls.md). Deploy the reviewed shared Firestore rules before the backend parity check. The rule change affects an account only after its canonical plan exists.
2. Verify the scoped standalone Hosting rewrite to the production projection function and the signed-in individual calculation before opening enrolment. Check that an unrelated profile edit still saves and an old tab cannot change either adopted array. Use synthetic accounts for release checks.
3. An operator opens five production seats by creating the server-only document `prod/data/finvisionControl/pilot` with `accepting: true`, `limit: 5`, and `enrolled: 0` once. Update only the intended field on later changes. Preprod uses its own control. Release fixtures use private, per-fixture gates in preprod and are cleaned after each run.
4. Set `accepting` to false to pause new transfers. Verify existing adopters can still edit and the standalone projection reflects their revision. Keep the canonical plan, receipt and protecting rules during a rollback. Recover using the private original and current revision, preserving later owner changes. Escalate a disputed transfer for private owner review before restoring any record.
5. Expand the pilot only after the acceptance run, transfer receipts, conflict handling and both sites agree. Track owner-visible failures and aggregate transfer outcomes in Dynatrace. No production household records are required for release verification.

New developer tokens require explicit planning scope. Existing token expiry and the read/write distinction still apply. The planner reads current holdings when open. No scheduled replication or cross-account financial lookup runs. [Pilot milestone](https://github.com/theharithsa/finbuddy/milestone/15) · [Standalone compatibility change](https://github.com/theharithsa/finvision-ai/pull/1)
