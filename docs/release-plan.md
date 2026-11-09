# FinBuddy release and rollback

1. Run the [checks](testing.md) and open a PR linked to [issue 111](https://github.com/theharithsa/budget-buddy/issues/111). Review the branch and verify the current head checks.
2. Build the preview with `VITE_RELEASE_REVISION` set to the checked Git SHA. Deploy to a temporary channel on site `finbuddy-2025` with `--no-authorized-domains` to avoid changing Firebase Auth configuration. Use the preview for signed-out visual review and the emulator for synthetic writes.
3. Obtain the review required by the repository ruleset and merge. The main workflow builds the checked merge revision, uploads the artifact, deploys that artifact to the live channel and verifies the served SHA.
4. Record the Hosting version, revision and CI results. Use the previous live version in Hosting release history to roll back. Verify the restored entrypoint and assets. Coordinate any later backend or rules release separately.

The first release targets the existing Firebase Hosting site. No schema migration is required. Firestore rules, Storage rules and the deployed Kautilya function have separate release lifecycles. Do not run a project-wide Firebase deployment from this checkout.
