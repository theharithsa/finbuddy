# MCP continuation

Inspected `22fdc36bf8e6f7aa2f2a31f9b394dcb04575b115` on 10 November 2026. The package is an operator-run local stdio service. It registers 16 tools for expenses, budgets, analytics and app lookup. The adapter uses the Firebase Admin SDK and reads or writes the same Firestore ledger and budget shapes as the web app.

- Install the MCP service lockfile with `npm ci` from its directory, then run `npm --prefix mcp-server run build` from the repository root. Start the emitted `dist/index.js` through the operator's MCP client.
- The local package build and stdio initialize and tools/list check passed for 16 tools during the audit. Treat a tool listing, a fixture tool operation, and a real operator session as separate observations. Keep credential paths and user values private. The Hosting pipeline has no MCP deployment step.
- Future network transport requires an explicit identity, authorization, and abuse-control review before deployment.
