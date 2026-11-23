# FinVision dashboard and personal planning

Open **Home → FinVision dashboard**. The same page is available from **Savings → Plan a goal** and **More → FinVision**. Add a goal with the amount you expect to need and its deadline. In **Link savings**, choose the share of an existing holding dedicated to that goal. Use **View goal** to switch between deadlines.

Choose **Add recurring deposit**, enter the monthly amount and the annual rate from your bank, then select the goal. Use **Deposit term** if the bank term differs from the goal date, or to estimate an unlinked deposit. For example, ₹5,000 at the start of each month for 12 months at 7% gives ₹60,000 in deposits and ₹2,310.66 in estimated interest. A blank rate shows deposits alone. Check the preview and save. The goal outlook shows the estimated balance, the remaining gap or surplus, and dated checkpoints.

The estimate uses beginning-of-month instalments and a quarterly nominal rate for RDs. Other investments use an effective annual return. Growth stops at the last deposit month. When a goal falls earlier, the page also shows the value at its date. Tax, early-withdrawal charges and bank rounding may change the payout. For the quarterly convention, see [ICICI Bank’s recurring deposit calculator](https://www.icici.bank.in/personal-banking/deposits/recurring-deposits/rd-calculator).

Each linked holding enters the goal at its recorded value. This month’s instalment is assumed due. If you have already recorded it in a holding, select **Instalments already paid → This month’s deposit is already in my linked savings**. For an ongoing RD whose earlier instalments are outside those holdings, you can explicitly count them from its start. A deposit’s full-term estimate always shows the scheduled term. Saving a forecast creates no income, expense or holding entry.

[Walk through a family goal](https://theharithsa.github.io/finbuddy/docs/product.html#plan-a-goal) · [Try the sample](https://finbuddy-2025.web.app/finvision?demo=1)

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
