---
name: service-mcp-server
description: Maintain FinBuddy's operator-run TypeScript MCP stdio adapter and its privileged Firestore access.
---

# FinBuddy MCP

Read the [continuation](continuation.md) and [MCP README](../../mcp-server/README.md). The local entrypoint is `mcp-server/src/index.ts`. Use the SDK and Zod versions in its lockfile.

- Keep the adapter on stdio for the trusted operator. Stdout carries protocol messages. The Firebase Admin SDK uses operator credentials and privileged access. Treat `FINBUDDY_USER_ID` as a convenience default and verify the intended user and project before tool calls.
- Preserve Firestore document shapes and tool schemas. Exercise reads and mutations only against authorized fixtures. Keep receipt URLs and private financial records out of diagnostic output.
- Run `npm --prefix mcp-server run build` after installing the service lockfile. Verify an initialize and tools-list handshake before testing tool execution.
- Keep MCP releases separate from Hosting. See [FinOps](../project-finops/SKILL.md) for the adapter's Firestore consumption and [mcp-builder](../mcp-builder/SKILL.md) for general protocol design.
