# FinBuddy API v1

Open **More → Settings → Developer Options** in the signed-in workspace. Generate a token, copy it once, and choose **Authorize** in the Swagger reference. Use a read-only token for exports and a read/write token for automations that change records.

## Endpoints

All routes use `/api/v1`. Swagger is at `/api/v1/docs` and the machine-readable OpenAPI 3.1 document is at `/api/v1/openapi.json`.

| Area | Endpoints |
| --- | --- |
| Ledger and budgets | List, create, retrieve, update and delete expenses and budgets |
| Organization | Manage private categories and people, recurring bill templates and budget templates |
| Household | Manage income, bills, and savings and investment holdings |
| Bill payments | List payment links and record or link one payment per bill occurrence |
| Account and reporting | Read the profile, built-in categories, people and platforms, and the monthly summary |
| Receipts | Download an existing owner-prefixed receipt through the expense route |
| Developer Options | List, generate and revoke tokens using a Firebase sign-in session |

The API uses the same account data as the workspace. Device-local appearance, demo data, public publishing, Kautilya, and FinVision have separate lifecycles. Shared records can be read by their owner through the API and edited from the workspace. Use the workspace to upload or remove receipt attachments, or to delete an expense with an attachment. Legacy receipts without the caller's owner prefix are excluded from API downloads.

## Authentication and requests

Choose 7, 30, or 90 days, or **Never expires**. The default in Settings is 30 days. Send `days: null` in the create request for a non-expiring token. The API returns `expiresAt: null` for that token and a UTC timestamp for dated tokens. Both kinds can be revoked in Developer Options. Token generation requires a recent sign-in. A personal API token can access only the account that created it. Developer Options uses Firebase ID tokens and is the only route family that accepts them. The OpenAPI reference keeps Swagger authorization in memory for the current tab.

Send the token in the `Authorization: Bearer` header. Keep it in your integration's secret store. The API is same-origin for browsers and can be called by server-side HTTP clients.

```sh
curl --fail-with-body "$FINBUDDY_BASE_URL/api/v1/summary?month=2026-01" \
  -H "Authorization: Bearer $FINBUDDY_API_TOKEN"
```

A create requires an `Idempotency-Key` header. Repeating the key with the same body returns the same record. A different body with the same key returns a conflict. Bill payments instead deduplicate by bill and due month. List routes support `limit` from 1 to 100 and an opaque `nextCursor`. IDs, dates and request sizes are validated. PATCH updates supplied fields.

Expense and budget amounts are in INR with up to two decimal places. Household and summary amounts use integer paise. The monthly summary reads a bounded set of records for the requested month and current holdings and budgets. Its remaining amount subtracts recorded expenses from recorded income. It does not subtract unpaid bills.

## Local verification

Use Node.js 22 for the API runtime and Java 21 for the Firestore and Storage emulators. Run the root app with `VITE_FIREBASE_EMULATORS=true` and the [isolated API configuration](../firebase.api.json). The Vite development server forwards `/api/v1` to the local function. The demo project keeps all synthetic writes out of production.

```sh
npm --prefix api ci
npm --prefix api test
npx --yes firebase-tools@14.20.0 emulators:exec --config firebase.api.json --only auth,firestore,functions,storage --project demo-finbuddy "npm --prefix api run test:emulator"
```

See the [release procedure](release-plan.md) for the first API deployment and Hosting cutover.
