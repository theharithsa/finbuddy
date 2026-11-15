# FinBuddy software development life cycle

FinBuddy uses the App Launchpad v1.14.0 solo-maintainer workflow. The checked implementation PR targets `main`. Tests use Firebase emulators with synthetic data, and changes that need hosted review can use the approved Firebase preview channel. FinBuddy has no persistent staging environment.

## From issue to merge

1. Start with an issue in the [FinBuddy Project](https://github.com/users/theharithsa/projects/1). Record the user outcome, acceptance criteria, owner, dependencies, and validation. Set the issue type and assign it to a milestone. Use the Sprint field for work you have scheduled and set the order from its dependencies.
2. Work on a short-lived branch from `main`. Keep the diff focused and check the [service inventory](services.md) and relevant service guidance when the change affects a dependency, deployment, or runtime boundary.
3. Open a PR with the issue, validation results, and the impact on rollout and rollback. Use `Closes #N` for full delivery and `Refs #N` for partial work. Review the relevant guides, README, changelog, and security guidance. In **Documentation impact**, write `Updated: <guides>` or `No change: <reason>`.
4. Review the current diff and resolve review threads. GitHub requires `foundation`, `verify`, and `verify-api` on a candidate that is up to date with `main`. The sole-maintainer rules require zero independent approvals. The maintainer makes the release decision through the implementation PR when merge triggers publication.

For a Dependabot PR, the maintainer reviews the dependency impact and adds the documentation decision to the PR description. Editing the description reruns the foundation check.

## Checks and release

| Check | Evidence |
| --- | --- |
| `foundation` | Project contracts, Markdown links, PR documentation decision, public handbook build and internal links, and Python tests. |
| `verify` | Web lint, unit tests, Firebase emulator browser tests, and a production web build. |
| `verify-api` | API unit and contract tests with Firebase emulator integration checks. |
| `package` | Builds the Pages artifact on changes that affect the product site or handbook. Review this result when the workflow runs for your PR. |

Use the [testing guide](testing.md) to choose local checks. For sign-in, data writes, permissions, or migrations, include tests for the affected boundary and existing data. Record the rollout order and recovery method in the PR when they differ by service.

On merge, GitHub Actions builds and checks the merged source. The Hosting job publishes the exact verified web artifact and checks the live revision and API routes. Pages publishes the product site and handbook through its own workflow. Record where each affected release can be verified and recovered. See the [release and rollback guide](release-plan.md) for the service-specific steps.

The same checks apply to urgent fixes. Keep this baseline stable and revisit it when the maintainer, release topology, or data and access risks change, or when a documented delivery failure shows a gap. Record any policy change in an issue and PR. Track application releases separately from the pinned [template version](versioning.md).
