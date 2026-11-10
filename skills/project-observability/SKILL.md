---
name: project-observability
description: Maintain FinBuddy browser RUM, callable telemetry and GitHub delivery evidence with verified Dynatrace boundaries.
---

# FinBuddy observability

Start with [FinBuddy's signal map](../../docs/observability.md) and the [App Launchpad observability policy](../../.agents/skills/app-launchpad/references/observability.md). Use the relevant service continuation to verify the current runtime.

- The browser wrapper records fixed operation names and allowlisted outcomes. RUM requires an approved Dynatrace tag and browser opt-in. Verify masking, replay settings, consent and account transitions before enabling it.
- Separate browser SDK results from durable Firestore outcomes. Treat the deployed callable and its source as separate until their revisions and telemetry are reconciled.
- Verify actual ingestion and searchability before reporting a Dynatrace signal as live. Keep monetary amounts, account identifiers, receipt details, prompts, secret values and raw errors out of telemetry.
- Use GitHub Actions for checked build and test facts and Firebase Hosting for deployment and served revision facts. Route cost and quota questions to [FinOps](../project-finops/SKILL.md).
- Use the pinned Thoth observer for FinBuddy GitHub Actions telemetry. Keep its credentials scoped to the observer, review the verified SDK digest when updating Thoth, and follow the signal map for setup and run-to-tenant verification.
