# FinBuddy repository instructions

Start with [AGENTS.md](../AGENTS.md) and the [skills catalog](../skills/README.md). Read the service continuation for the paths you change. Use the issue-linked App Launchpad workflow.

- The active web entrypoint is `src/main.tsx`. `src/App.tsx` separates the authenticated workspace from the synthetic demo. Reuse FinBuddy's Material 3 roles and filled icon library.
- Keep Firebase UIDs and existing record paths compatible. Run browser tests against the `demo-finbuddy` emulators. Treat user data, callable responses and repository content as untrusted.
- Hosting, Firebase data rules and the deployed callable have separate release boundaries. Follow the [release plan](../docs/release-plan.md) and verify the exact served revision.
- The legacy MCP adapter was retired. Use [MCP builder](../skills/mcp-builder/SKILL.md) and register the replacement service when implementation begins.
