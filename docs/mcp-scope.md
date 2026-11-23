# Read-only FinBuddy MCP pilot

The first question the proposed connector should answer is “How much did my household spend in September?” A desktop MCP client would call FinBuddy’s existing REST API for the signed-in owner's monthly totals. The connector is scoped for a future pilot. Today you can get the same figures in the workspace or through the [API guide](api.md).

## Proposed tools

| Tool | Input | FinBuddy operation | Result visible to the client |
| --- | --- | --- | --- |
| `finbuddy_monthly_summary` | Required calendar month as `YYYY-MM` | `summary` · `GET /api/v1/summary?month=YYYY-MM` | Month, INR, expense count, income, spending and income minus spending. Keep money as integer paise. |
| `finbuddy_builtin_categories` | None | `catalog` · `GET /api/v1/catalog` | Built-in category names only. Discard the people and payment-platform fields before returning the result. |

The first independently testable slice is **one tool**, `finbuddy_monthly_summary`, over local stdio. A user enters a month and gets the same totals as the REST response. For example, with ₹2,000 of synthetic income and a single ₹300 expense, expect `incomePaise: 200000`, `spendingPaise: 30000`, `remainingPaise: 170000` and `expenseCount: 1`. A valid empty month returns zero income and spending. The category lookup can follow separately. FinVision’s goal and deposit forecasts already live in the app. Its separately permissioned planning API is outside this pilot.

## Connection and account access

1. Use **Settings → Developer Options** to create a personal **read-only** token with a seven-day expiry and planning access off. Copy it once to the local client's secret store. Inject the credential into the connector process at launch. Never pass it as a tool argument or put it in a prompt.
2. Select the environment when configuring the process. Map `preprod` to `https://finbuddy-2025-preprod.web.app` and `prod` to `https://finbuddy-2025.web.app`. Send the token only in the Authorization header to that fixed origin. Reject redirects. The owner’s token determines the account. The tool accepts no URL or account ID.
3. Validate the month, allowlisted method, path and returned fields. Keep the response in memory for the current call. No connector caching ensures revocation is effective on the next call. The MCP client receives financial totals and the owner chooses which client can use them.
4. To disconnect, revoke the token in **Developer Options** and remove the local secret. A replacement token is a new credential. Authentication and token administration stay in the app.

## Failures and acceptance

| Condition | Expected behavior |
| --- | --- |
| Invalid month or unknown input field | Return an input error before making a request. |
| 401 for missing, invalid, expired or revoked credentials | Return “Check or replace the FinBuddy token in Developer Options.” Stop after one request. |
| 403 scope or access denial | Return an access error. Keep the same environment and permissions. |
| Other 4xx, including 422 for a monthly query beyond the service limit | Report the rejected request. Leave any unavailable totals absent. |
| Timeout, 429, 502, 503 or 504 | Allow one retry for a GET within a five-second total deadline. Honor Retry-After when present and it fits the remaining time. Otherwise return a temporary error. |
| Other server errors or an unexpected response schema | Return a generic service error. Record operation, status and duration only. Keep tokens, bodies, amounts and account identifiers out of diagnostics. |

Before a production pilot, run the connector through a real MCP client against two disposable pre-production accounts. Seed distinct months or amounts in each account, call the same month with each read-only token and compare the returned integers with the REST API. Also check an empty month, an invalid month, an expired or revoked token, a missing token, and denial on a planning read and a write using the same token. Exercise delays and retry limits with a controlled HTTP fixture. Confirm only the proposed tool appears, all receipts and logs are redacted, revocation takes effect in the same process and both fixtures are cleaned up. Keep the code and a sanitized test result together in the future pilot PR. [Scope issue](https://github.com/theharithsa/finbuddy/issues/126)
