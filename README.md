# FinBuddy

FinBuddy is an INR-first household finance workspace. See what came in this month, review what went out, check bills and EMIs, and keep dated records of savings and investments.

[Open FinBuddy](https://finbuddy-2025.web.app/) · [Try the sample household](https://finbuddy-2025.web.app/?demo=1) · [Watch the product tour](https://theharithsa.github.io/finbuddy/#tour) · [Help center](https://finbuddy-2025.web.app/docs/) · [Project handbook](https://theharithsa.github.io/finbuddy/docs/product.html)

[Roadmap](https://theharithsa.github.io/finbuddy/docs/roadmap.html) · [Release history](https://theharithsa.github.io/finbuddy/docs/releases.html)

## A month in FinBuddy

The public demo opens without an account and uses a fictional household. Screenshots below show the running demo.

| Monthly Home | Expense ledger |
| --- | --- |
| ![Monthly Home with recorded income, spending and upcoming bills](site/media/home.jpg) | ![Expense ledger showing sample transactions and period controls](site/media/expenses.jpg) |
| **Bills & EMIs** | **Savings** |
| ![Bills and EMIs showing paid and upcoming sample payments](site/media/bills.jpg) | ![Savings showing recorded values for an emergency fund, SIP and deposit](site/media/savings.jpg) |

The signed-in workspace adds expense entry and receipts, category budgets, recurring expense templates, and Developer Options for the REST API. The Savings view shows recorded values with an as-of date. [User guide](https://finbuddy-2025.web.app/docs/) · [API and Developer Options](docs/api.md)

## How it works

| Layer | Implementation |
| --- | --- |
| Web app | React, TypeScript, and Vite with Material 3 styles. Feature routes live in `src/features/`. |
| Account and data | Firebase Authentication, Firestore for financial records, and Cloud Storage for receipt attachments. |
| REST API | Firebase Functions serve `/api/v1` through Firebase Hosting. Developer Options issues scoped personal tokens. OpenAPI and Swagger describe the supported operations. |
| Money and dates | The household model stores integer paise. The monthly views use local calendar boundaries, and bill payments link to expense records. |
| Delivery | Protected `preprod` runs audits, foundation, web/browser/API and Functions checks, then isolated hosted acceptance. A verified promotion releases the accepted production artifact and Pages source. See [release controls](docs/release-controls.md). |

[Service inventory](docs/services.md) · [Material 3 design](docs/design.md) · [Observability](docs/observability.md) · [SDLC](docs/sdlc.md) · [Release and rollback](docs/release-plan.md)

## Run locally

Use Node.js 24 and Python 3.12. Start with the demo to explore the UI. Use the Firebase emulators before testing account creation, transaction writes, or token management.

```sh
npm ci
npm run dev
```

Open the address printed by Vite and add `?demo=1`. Use the testing guide for emulator commands and the API's Node.js 22 runtime. [Testing guide](docs/testing.md)

## Contribute and report issues

Start with a linked GitHub issue, keep changes focused, and include verification in your PR. Use synthetic data in public artifacts. Report suspected security issues privately through the repository's Security tab. [Contribution guide](CONTRIBUTING.md) · [Security policy](SECURITY.md) · [Issue forms](https://github.com/theharithsa/finbuddy/issues/new/choose) · [Project board](https://github.com/users/theharithsa/projects/1)

Licensed under [MIT](LICENSE). Template version: **1.14.1** · [App Launchpad provenance](project.json)

## Firebase environments

FinBuddy uses one Firebase project, `finbuddy-2025`. The protected `preprod` and `main` branches deploy the `preprod` and `prod` Hosting targets, with separate Firestore roots `preprod/data` and `prod/data`. Existing Auth identities are shared. [Read the architecture, migration, verification and recovery guide](docs/firebase-consolidation.md). FinVision's existing resources are preserved.
