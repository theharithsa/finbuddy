---
name: service-foundation-tooling
description: Maintain the foundation validators, service registration and opt-in ruleset tooling.
---

# FinBuddy foundation tooling

Owner is theharithsa. Scope is repository validation and TypeScript release-control tooling plus the GitHub checks. Use the continuation for FinBuddy provider and revision evidence. Read [catalog](../catalog.json), [continuation](continuation.md) and the [service contract](../../.agents/skills/app-launchpad/references/services.md).

| Entry/module | Contract and extension point |
| --- | --- |
| `scripts/check_foundation.py` | Structure, SemVer/provenance and optional discovery gate; text or JSON diagnostics; nonzero on failure |
| `scripts/schema_validation.py`, `contracts.py` | [Schemas](../../schemas/README.md) and required/status constants; synchronize schema/validator/test changes |
| `scripts/skill_catalog.py` | Accumulated sorted path, inventory and graph diagnostics; reads metadata without executing commands |
| `scripts/check_links.py` | Local Markdown links in regular/hidden docs; no network; fenced examples excluded |
| `scripts/add_service_skill.py` | Planned skill/continuation/catalog registration; no application source creation |
| `scripts/repository_ruleset.py` | Local preview by default; explicit authorized apply and read-back verification |
| `scripts/check.sh` | The shared CI/local/catalog entrypoint: foundation, links, tests; fails before later steps after error |
| `scripts/release-control.mts` | Candidate hashes, trusted-run/owner receipt, age, source and promotion-tree validation; rejects invalid evidence before cloud authentication |
| `scripts/deploy-release.mts`, `live-acceptance.mts` | Explicit project deployment and guarded hosted synthetic verification; require the authorized release scope and preserve component recovery metadata |

## Registration and recovery

- Generator preflight rejects unsafe paths, duplicate identities, symlinks and existing output. Exclusive catalog lock coordinates generators; final replacement is atomic; failed generation removes only its newly created directory.
- Avoid concurrent manual catalog edits. After process interruption, inspect active processes, catalog and generated files before removing a stale `.catalog.lock` or `.catalog.next`; never discard external work blindly.
- Planned source directories may be absent. Active-service schema/domain checks require owner, real source/entrypoint paths and test commands. CI cannot infer undeclared services or semantic freshness.

## Verification and delivery

- Run `sh scripts/check.sh`. Tests use synthetic temporary repositories, metadata failures, schema parity, generator failure paths, links, entrypoint behavior and ruleset previews/mocked apply.
- Follow [delivery](../../docs/delivery.md) for source changes and [ruleset procedure](../../docs/repository-ruleset.md) for settings. Consumer upgrades arrive through reviewed PRs; there is no runtime deployment/database rollback for these local commands.
- Template version/provenance follows [versioning](../../docs/versioning.md); app and upstream skill versions are separate. The partial bootstrap was removed in this baseline.
- Run `npm run typecheck:release` and `npm run test:release-control` for the TypeScript release tools. Negative tests cover failed/missing/stale receipts, wrong source/tree/project/run/actor, fork/PR artifacts, rerun attempts and changed artifact contents.
- The separate pinned Thoth observer records trusted main/preprod push execution without cloud-write credentials or log export. Runtime application signals and tenant acceptance have separate owners. Apply the [evidence contract](../../.agents/skills/app-launchpad/references/evidence.md) to handoff and reporting.
