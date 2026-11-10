---
name: project-finops
description: Review FinBuddy cloud cost, provider usage, quotas and budget controls before operational changes or when investigating spend.
---

# FinBuddy FinOps

Use the [cost inventory](references/cost-inventory.md) and the [service catalog](../catalog.json). Verify the project, provider account scope, period and currency before interpreting a number. Owner for the FinBuddy repository and operating decisions is `theharithsa`. Confirm the current billing and alert owners with the provider.

1. Open a project-filtered billing report or an existing approved export. Compare like periods and record usage, gross/net cost, credits, and known delays separately. Attribute a change to a feature only after correlating the SKU and service usage with the release and measured workload.
2. Separate provider billable quantities from client and runtime telemetry. Look at request volume, bytes, reads or model tokens as drivers. Use a scoped denominator such as active households or successful operations only when measured for the same period.
3. For a proposed change, model normal, peak and retry cases from the affected meters. Document where costs are shared, who owns the budget, what controls exist, and how to verify the outcome after rollout.
4. Review actual and forecast alerts with the authorized owner. Alerts-only budgets send notifications. Verify any separate caps, quotas and limits from their owning provider. Obtain authorization before changing budgets, quotas, capacity, retention or resource configuration.

Keep billing credentials, account IDs and private spend records outside the public repo. Mark spend, budgets or usage as unverified when the source is unavailable.
