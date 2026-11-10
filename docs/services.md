# FinBuddy service inventory

The [catalog](../skills/catalog.json) records owners, entrypoints, contracts, checks, and the last inspected revision.

| Service | Runtime and data | Release boundary |
| --- | --- | --- |
| [Web](../skills/service-web/SKILL.md) | React/Vite and Firebase browser SDK | Firebase Hosting site `finbuddy-2025` |
| [Firebase data](../skills/service-firebase-data/SKILL.md) | Firebase Auth, Firestore default database and receipt storage | Provider settings, Firestore rules and indexes, and Storage rules have distinct lifecycles |
| [Firebase Functions](../skills/service-firebase-functions/SKILL.md) | Live Gen 2 `chatWithKautilya` on Node.js 22 in `us-central1` | Separate callable deployment after source reconciliation |
| [Foundation tooling](../skills/service-foundation-tooling/SKILL.md) | Python tooling and GitHub Actions | Repository checks and authorized repository settings |

[Observability](observability.md) and [FinOps](../skills/project-finops/SKILL.md) apply across services. Firebase lists a separate FinVision Hosting site in the same project. Its integration remains planned.

The legacy MCP adapter and editor registration are retired. Its [released source](https://github.com/theharithsa/finbuddy/tree/v3.0.0/mcp-server) remains in Git history. Register the planned replacement as a new service when implementation starts.
