---
name: project-design
description: Design FinBuddy journeys, Material 3 screens, and financial data contracts before implementing a feature.
---

# FinBuddy design

Read the [approved decisions](../../docs/decisions.md), [design](../../docs/design.md), and affected [service skills](../README.md). Record unresolved decisions using the [App Launchpad discovery procedure](../../.agents/skills/app-launchpad/references/discovery.md).

- Start with the household task and the smallest action it needs. Reuse the workspace shell, Material 3 roles, shared monochrome glyphs, INR formatting, and device-local appearance settings. Check narrow screens, keyboard focus, dark mode, and reduced motion.
- Distinguish ledger activity, future bill commitments, and dated holding values. Map each value to its owning record and date. Use the existing bill payment link when a payment already exists.
- Define visible loading, empty, denial, retry and conflict states. Preserve unsaved form values through reversible confirmation steps.
- Keep the sample workspace synthetic. For account or sharing changes, define identity, ownership, consent and account switching before the UI contract.
- If a proposal changes cloud reads, uploads, model use or retention, run [FinOps](../project-finops/SKILL.md) before selecting defaults.
