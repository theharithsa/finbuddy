# FinBuddy

FinBuddy is an INR-first household finance workspace for tracking income, everyday spending, upcoming bills and EMIs, and the latest value of savings and investments.

Template version: **1.9.0** · [App Launchpad adoption](project.json) · [FinBuddy release plan](docs/release-plan.md)

[Open FinBuddy](https://finbuddy-2025.web.app) · [User help](https://finbuddy-2025.web.app/docs/) · [Report an issue](https://github.com/theharithsa/finbuddy/issues/new/choose)

## Run locally

Use Node.js 24 and run `npm ci`, then `npm run dev`. Local development uses FinBuddy’s Firebase project by default. To work with synthetic accounts and transactions, start the isolated Firebase emulators and follow the [testing guide](docs/testing.md).

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/features/account` | Sign-in, registration and recovery |
| `src/features/household` | Monthly Home, bill payments, savings and investment values |
| `src/features/workspace` | Monthly overview, spending calculations and expense ledger |
| `src/components` | Feature screens, expense dialogs and shared controls |
| `src/lib/firebase.ts` | Firebase client and existing document contracts |
| `api` | Versioned REST API, Swagger reference, and token management |
| `functions` | Historical callable source. Live Kautilya deployment differs. |
| `skills`, `schemas`, `qa` | App Launchpad catalog, contracts and evidence |

See [Material 3 design](docs/design.md), [decisions](docs/decisions.md), [API and Developer Options](docs/api.md), [service inventory](docs/services.md), [observability](docs/observability.md) and [release and rollback](docs/release-plan.md).
