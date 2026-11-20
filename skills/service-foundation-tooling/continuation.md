# FinBuddy foundation continuation

The [#172 release-control implementation](https://github.com/theharithsa/finbuddy/issues/172) adds typed source/artifact/acceptance validation and negative tests. Seven release-control regression scenarios passed locally, including rejection of missing, failed, stale, rerun, wrong-source/tree/project/actor and fork/workflow evidence. Source is typechecked through `tsconfig.release.json`; provider/environment controls and integrated live results are recorded in #172/#174. The GitHub preprod ruleset is `Pre-production branch protection` (ID `27697533`); both branch policies retain zero independent reviewers. Re-read effective rules before acting.

Inspected `22fdc36bf8e6f7aa2f2a31f9b394dcb04575b115` on 10 November 2026. FinBuddy adopted App Launchpad v1.9.0 at `f04c042a9e000f606982863518fa7bb9cfbb7d85`. The application tag and template version are tracked separately.

- Run `sh scripts/check.sh` locally and in CI. On Windows, put Git Bash on PATH for the shell entrypoint test. The [merged foundation run](https://github.com/theharithsa/finbuddy/actions/runs/42706196096) passed.
- FinBuddy's active branch ruleset is `Main-Branch-Protection` (ID `11722952` as observed). Re-read provider state before acting. Use the [repository ruleset procedure](../../docs/repository-ruleset.md) only for an authorized settings change.
- Generate actual new services with `scripts/add_service_skill.py`. Fill the resulting contracts, tests and continuation using observed source. Foundation validation covers structure and cross-references. Service owners verify semantic accuracy and runtime claims.
- Keep template provenance in `project.json` and use [the evidence schema](../../schemas/evidence.schema.json) for checked, merged, deployed and verified observations.

On 12 November 2026, FinBuddy adopted the App Launchpad and dt-obs skills and foundation validation from template v1.12.0 at `ffb83b7679e40a786ad30d35a45efb729c821744`. See [delivery](../../docs/delivery.md) for the scope.
