# Dependency maintenance — November 2026

[Issue #173](https://github.com/theharithsa/finbuddy/issues/173) tracks the residual dependency assessment after update PRs #164–#168. The accepted release still needs the integrated [pre-production rehearsal](https://github.com/theharithsa/finbuddy/issues/174); a dependency source merge does not establish deployment.

The root web project updates `typescript-eslint` to exact version `8.73.0` and refreshes its patched transitive dependencies. The historical Functions package uses the same compatible Firebase SDK versions as the REST API: `firebase-admin` `14.5.1` and `firebase-functions` `7.4.0`. Its unused `firebase-functions-test` development dependency is removed: there are no tests or source imports using it. The remaining indirect packages are resolved in the lockfile without broad overrides or audit exceptions.

The root and Functions lockfile audits reported zero vulnerabilities after the updates, and the historical Functions TypeScript build passed on Node 22. Required CI rechecks lint, web unit/browser/build and API behavior. The release workflow additionally audits all three package trees and builds `/functions` on Node 22. Record current-head CI and the final integrated audit results in #173 because registry advisories can change.

## Runtime boundary

`api/` is the deployed REST API and expense-audit codebase. The source in `/functions` exports historical callable entrypoints and is not selected by the new release workflow. Updating that source tree removes known source/build exposure and keeps it buildable; it does not update or verify the separately deployed `chatWithKautilya` callable. That route remains Coming soon, and any future callable release must reconcile its actual source, identity, secret/model contract and recovery first.

No household data, public API schema or user workflow changes in this dependency patch. [Issue #172](https://github.com/theharithsa/finbuddy/issues/172) implements the release controls; the [reviewed release plan](preproduction-plan.md) defines pre-production acceptance before production.
