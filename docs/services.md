# Service inventory

The [catalog](../skills/catalog.json) records entrypoints, owners and tests.

| Service | Runtime | Release boundary |
| --- | --- | --- |
| [FinBuddy web](../skills/service-web/SKILL.md) | React and Firebase browser SDK | Firebase Hosting site finbuddy-2025 |
| [Kautilya callable](../skills/service-firebase-functions/SKILL.md) | Firebase Functions Gen 2, Node.js 22 in production | Separate callable deployment |
| [MCP adapter](../skills/service-mcp-server/SKILL.md) | Local Node.js stdio with Firebase Admin SDK | Separate local build and operator credentials |
| [Foundation tooling](../skills/service-foundation-tooling/SKILL.md) | Python and GitHub Actions | Repository checks |
