---
name: project-documentation
description: Update FinBuddy user help, service references, and release records from checked code and runtime evidence.
---

# FinBuddy documentation

Use the [service inventory](../../docs/services.md) and current source to identify the owning document. Update the user help under `public/docs/` when behavior changes, and update the relevant skills and continuation for operational changes.

- Distinguish available web features, the synthetic demo and planned capabilities. Check named routes, field defaults, screenshots and release labels against the actual UI before publication.
- Use the [product launch procedure](../../.agents/skills/app-launchpad/references/product-launch.md) to refresh the public README, sample household media, and GitHub Pages site.
- Use approved synthetic screenshots for explanations. Apply the bundled [illustration skill](../ian-xiaohei-illustrations/SKILL.md) when an illustration helps explain a flow, and preserve its notices.
- Source current deployment and cost claims from their providers. Preserve failed and later passing observations as separate entries in [release evidence](../../qa/evidence.json).
- Keep the GitHub links canonical, preserve the upstream template and third-party notices, and run the [local link checker](../../scripts/check_links.py) with the foundation checks.
