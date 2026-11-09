# FinBuddy revival

FinBuddy helps people track INR spending and see how it compares with category budgets. The first release starts at the month overview and keeps expense entry accessible from any workspace page.

## Release acceptance

- A new user can sign up and create an expense. A returning user sees existing expenses on their original Firebase account.
- The current month uses local calendar dates. Opening the ledger from the overview carries its month across. A user can search, filter, edit and delete an expense.
- Primary navigation works on phones and desktops. The workspace distinguishes loading, empty and failed reads.
- Budgets, recurring templates, people, categories, Metrics Explorer and KautilyaAI retain entry points.
- A reviewed release serves the exact checked revision from FinBuddy Hosting.

## Follow-on work

1. Reconcile the deployed Kautilya service with source control, verify AI opt-in and data minimization, and test callable denial and model failure in an isolated environment.
2. Reconcile shared Firestore and Storage rules with FinVision, then test scoped receipts and privacy changes before a rules release.
3. Verify Dynatrace capture settings and ingestion, then exercise read, write and release journeys and record tenant evidence.
