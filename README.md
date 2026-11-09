# FinBuddy

FinBuddy is an INR-first personal finance workspace for tracking everyday spending, setting category budgets, and reviewing spending by month.

Template version: **1.9.0** · [App Launchpad adoption](project.json) · [FinBuddy release plan](docs/release-plan.md)

[Open FinBuddy](https://finbuddy-2025.web.app) · [User help](https://finbuddy-2025.web.app/docs/) · [Report an issue](https://github.com/theharithsa/budget-buddy/issues/new/choose)

## Run locally

Use Node.js 24 and run `npm ci`, then `npm run dev`. Local development uses FinBuddy’s Firebase project by default. To work with synthetic accounts and transactions, start the isolated Firebase emulators and follow the [testing guide](docs/testing.md).

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/features/account` | Sign-in, registration and recovery |
| `src/features/workspace` | Monthly overview, spending calculations and expense ledger |
| `src/components` | Feature screens, expense dialogs and shared controls |
| `src/lib/firebase.ts` | Firebase client and existing document contracts |
| `functions` | Historical callable source. Live Kautilya deployment differs. |
| `mcp-server` | Local stdio MCP adapter with separate credentials and lifecycle |
| `skills`, `schemas`, `qa` | App Launchpad catalog, contracts and evidence |

See [decisions](docs/decisions.md), [service inventory](docs/services.md), [observability](docs/observability.md) and [release and rollback](docs/release-plan.md).
