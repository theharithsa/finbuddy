# FinBuddy software development life cycle

FinBuddy uses the App Launchpad v1.14.1 solo-maintainer workflow. Implementation PRs target protected `preprod`; a trusted staging push builds, deploys and tests the isolated [pre-production app](https://finbuddy-2025-preprod.web.app/) within Firebase project `finbuddy-2025` under `preprod/data`. Production promotion uses a PR from `preprod` to protected `main` and the acceptance receipt for that exact source.

The [release controls](release-controls.md) specify source/artifact identity, owner runtime acceptance, effective environment isolation and rejected promotion cases. [Issue #172](https://github.com/theharithsa/finbuddy/issues/172) records implementation and verification; [#174](https://github.com/theharithsa/finbuddy/issues/174) owns the integrated rehearsal. The [backlog plan](preproduction-plan.md) retains the earlier audit snapshot and target order. A promotion merge is the authorized production release decision.

## From issue to merge

1. Start with an issue in the [FinBuddy Project](https://github.com/users/theharithsa/projects/1). Record the user outcome, acceptance criteria, owner, dependencies, and validation. Set the issue type and assign it to a milestone. Use the Sprint field for work you have scheduled and set the order from its dependencies.
2. Work on a short-lived branch from `preprod`. Keep the diff focused and check the [service inventory](services.md) and relevant service guidance when the change affects a dependency, deployment, or runtime boundary.
3. Open a PR with the issue, validation results, and the impact on rollout and rollback. Use `Closes #N` for full delivery and `Refs #N` for partial work. Review the relevant guides, README, changelog, and security guidance. In **Documentation impact**, write `Updated: <guides>` or `No change: <reason>`.
4. Review the current diff and resolve review threads. The branch requires current-head foundation, web, API and historical Functions checks. Production additionally requires `promotion` and the exact-source `preprod-acceptance` receipt. The sole-maintainer rules retain zero independent approvals. Keep runtime acceptance separate from source merge.

For a Dependabot PR, the maintainer reviews the dependency impact and adds the documentation decision to the PR description. Editing the description reruns the foundation check.

For new or materially changed public guides, follow the [first-time reader walkthrough](../.agents/skills/app-launchpad/references/product-launch.md#first-time-reader-walkthrough). Exercise the affected paths on the PR candidate and record live results after publication.

## Checks and release

| Check | Evidence |
| --- | --- |
| `foundation` | Project contracts, Markdown links, PR documentation decision, public handbook build and internal links, and Python tests. |
| `verify` | Web lint, unit tests, Firebase emulator browser tests, and a production web build. |
| `verify-api` | API unit and contract tests with Firebase emulator integration checks. |
| `verify-functions` | Historical Functions source build and dependency audit on Node 22; no callable deployment. |
| `promotion` | Exact accepted staging source/run/attempt, receipt age, artifact/API digests and unchanged promotion tree. |
| `package` | Builds the Pages artifact on changes that affect the product site or handbook. Review this result when the workflow runs for your PR. |

Use the [testing guide](testing.md) to choose local checks. For sign-in, data writes, permissions, or migrations, include tests for the affected boundary and existing data. Record the rollout order and recovery method in the PR when they differ by service.

After staging checks pass, deploy the identified pre-production candidate and complete its live tests, fresh tenant evidence, recovery rehearsal and synthetic cleanup. Record the owner acceptance on that source. The production workflow rechecks this receipt before cloud authentication, deploys the API/audit prerequisites and exact accepted production web bundle, and repeats live checks. Pages publishes from the same accepted source. See the [release and rollback guide](release-plan.md) for service-specific recovery.

The same checks apply to urgent fixes. Keep this baseline stable and revisit it when the maintainer, release topology, or data and access risks change, or when a documented delivery failure shows a gap. Record any policy change in an issue and PR. Track application releases separately from the pinned [template version](versioning.md).
