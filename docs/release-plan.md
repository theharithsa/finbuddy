# FinBuddy release and rollback

1. Run the [checks](testing.md) and open a PR linked to [issue 111](https://github.com/theharithsa/budget-buddy/issues/111). Review the branch and verify the current head checks.
2. Build the preview with `VITE_RELEASE_REVISION` set to the checked Git SHA. For signed-in review, reuse the authorized FinBuddy preview channel. Deploy with `--no-authorized-domains` to preserve the shared Auth list. For a new signed-in preview, verify that Firebase serves FinBuddy on the exact hostname, then authorize that hostname and check that Google opens its account chooser. Remove the exact preview hostname from Auth when the channel is retired. Use the emulator for synthetic writes.
3. Obtain the review required by the repository ruleset and merge. The main workflow builds the checked merge revision, uploads the artifact, deploys that artifact to the live channel and verifies the served SHA and brand assets.
4. Record the Hosting version, revision and CI results. Use the previous live version in Hosting release history to roll back. Verify the restored entrypoint and assets. Coordinate any later backend or rules release separately.

The first release targets the existing Firebase Hosting site. No schema migration is required. Firestore rules, Storage rules and the deployed Kautilya function have separate release lifecycles. Do not run a project-wide Firebase deployment from this checkout.
