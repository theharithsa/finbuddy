---
name: service-mcp-server
description: Maintain FinBuddy's operator-run stdio MCP adapter and its Firestore access.
---

# FinBuddy MCP

Read the [MCP README](../../mcp-server/README.md) and [continuation](continuation.md). The adapter uses privileged Firebase Admin SDK credentials. Keep it local to the operator and preserve document contracts. Changes require a separate type check and authorization review.
