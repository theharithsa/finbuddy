# Firebase data continuation

Inspected `22fdc36bf8e6f7aa2f2a31f9b394dcb04575b115` on 10 November 2026. The Firebase project is `finbuddy-2025`. Google Cloud reports the default Firestore database in `asia-south1` and the receipt bucket `finbuddy-2025.firebasestorage.app` in `US-EAST1`.

- Auth preserves the existing identity and Google and email sign-in flow. The public demo uses synthetic records. Browser emulator scenarios use `demo-finbuddy`.
- Firestore records include expenses, budgets, custom categories and people, templates, household income, bills, holdings and payment links. Public library collections require an explicit rule and a separate access review.
- Storage uses the existing receipt compatibility path. Before any rules release, verify owner and second-account outcomes with synthetic receipts, including older records. Audit overlaps and provider policy before claiming isolation.
- The latest Hosting workflow deployed the web artifact. It did not publish Firestore or Storage rules. The Rules API read was denied with HTTP 403 during this audit, so deployed rule parity remains unverified.
- Next verification for a rules change is a read-back of the target releases, emulator coverage for owner, second-account and signed-out access, and an approved rollback source. See [release plan](../../docs/release-plan.md).
