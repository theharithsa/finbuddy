# FinBuddy skills catalog

Read [catalog.json](catalog.json), select the workflow and service skills for the changed paths, then read the affected continuations. [AGENTS.md](../AGENTS.md) routes agents here from the template entrypoint.

| Task | Skill |
| --- | --- |
| Issue-to-release workflow | [App Launchpad](../.agents/skills/app-launchpad/SKILL.md) |
| Product, Material 3 and data design | [Design](project-design/SKILL.md) |
| Implementation | [Implementation](project-implementation/SKILL.md) |
| Verification and tests | [Testing](project-testing/SKILL.md) |
| Deployments and rollback | [Deployment](project-deployment/SKILL.md) |
| Dynatrace and delivery evidence | [Observability](project-observability/SKILL.md) |
| Billing, usage, budgets and quotas | [FinOps](project-finops/SKILL.md) |
| Resume or hand off | [Handoff](project-handoff/SKILL.md) |
| User help, docs and evidence | [Documentation](project-documentation/SKILL.md) |
| Explanatory illustrations | [Ian Xiaohei](ian-xiaohei-illustrations/SKILL.md) |
| MCP protocol design | [MCP builder](mcp-builder/SKILL.md) |

| Service boundary | Skill |
| --- | --- |
| React workspace and Hosting | [Web](service-web/SKILL.md) |
| Firebase Auth, Firestore and receipt storage | [Firebase data](service-firebase-data/SKILL.md) |
| Firebase callable | [Functions](service-firebase-functions/SKILL.md) |
| Local operator adapter | [MCP](service-mcp-server/SKILL.md) |
| Repository checks and registration | [Foundation tooling](service-foundation-tooling/SKILL.md) |

## Register and maintain a skill

Use the [service policy](../.agents/skills/app-launchpad/references/services.md) to decide whether a module needs its own entry. For an actual new service, preview and then run the generator against its source path.

```sh
python3 scripts/add_service_skill.py --id SERVICE_ID --source-path ACTUAL_SOURCE_DIRECTORY --dry-run
python3 scripts/add_service_skill.py --id SERVICE_ID --source-path ACTUAL_SOURCE_DIRECTORY
```

Fill the generated skill, continuation, and catalog from current source and verified execution. Use concise name and description frontmatter. Add supporting references only where the task needs them. Register a workflow in `catalog.json` with its path and dependencies. Run `sh scripts/check.sh` and validate changed skill frontmatter.

Template provenance lives in [project.json](../project.json). The App Launchpad workflow and bundled Ian Xiaohei skill are kept at the verified template revision. Ian Xiaohei has its own [version](ian-xiaohei-illustrations/VERSION) and [notice](ian-xiaohei-illustrations/NOTICE.md). FinBuddy-specific guidance lives in the consumer skills. The legacy MCP builder retains its original license and references and routes FinBuddy work to the current service skill.

See the [catalog schema](../schemas/catalog.schema.json), [evidence schema](../schemas/evidence.schema.json), [policy ownership map](../docs/policy-map.md), [test catalog](../docs/testing.md), and [service inventory](../docs/services.md).
