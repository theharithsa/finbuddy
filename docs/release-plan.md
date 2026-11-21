# FinBuddy release and rollback

Follow the [FinBuddy SDLC](sdlc.md) from issue intake through release verification. In the implementation PR, review the README, changelog, security guidance, and affected user, settings, technical, or delivery guides. Record what changed or why the existing documentation still applies.

Production and persistent pre-production share Firebase project `finbuddy-2025` with explicit Hosting targets and `prod/data` / `preprod/data` collection roots. Follow the [consolidation guide](firebase-consolidation.md) for migration and recovery. Follow the [release controls](release-controls.md) for the staged candidate, exact-source acceptance, OIDC deployment and promotion rejection cases. The [pre-production plan](preproduction-plan.md) preserves the audit and backlog sequence; runtime receipts are tracked in #174 and #169.

## Product site and handbook

The [Hosting workflow](../.github/workflows/finbuddy.yml) builds the Help Center into the verified app artifact. After Hosting and API checks succeed, it calls the [Pages workflow](../.github/workflows/product-pages.yml) to publish the same revision. Verify the changed pages from the [live product site](https://theharithsa.github.io/finbuddy/) and the [live Help Center](https://finbuddy-2025.web.app/docs/), including the `source-revision` meta tag, links, and affected product media at desktop and phone widths. If a publication needs recovery, revert the scoped site or guide change through a PR and verify the replacement deployment.

## Web Hosting

1. Open an issue-linked PR and run the [checks](testing.md) for the exact head. Obtain the review required by GitHub and verify the merge commit.
2. For authorized preview review, build with `VITE_RELEASE_REVISION` set to the tested Git SHA. Reuse the approved preview channel for sign-in tests. Deploy with `--no-authorized-domains` to preserve the existing Auth list. Verify a new hostname and obtain authorization before editing Auth domains. Use emulators for synthetic writes.
3. The [application workflow](../.github/workflows/finbuddy.yml) builds both environment bundles in the staging run and stores `finbuddy-release-<attempt>`. Production verifies the accepted source/run/attempt and artifact digests before OIDC authentication, then publishes the accepted production bundle. Environment-scoped workload identity replaces the legacy Hosting key in this path. Manual recovery still requires the identified compatible Hosting version and backend releases.
4. Verify the live SHA, cache headers and assets with `node scripts/verify-hosting.mjs https://finbuddy-2025.web.app <accepted-source-sha>`. The source marker identifies the accepted staging source, while GitHub separately records the promotion merge commit. CI uses `--wait-for-revision` for a bounded propagation delay. Other failures stop the job immediately. Record failed checks and any later verification in the linked issue.
5. Record the Hosting version and live release ID, the SHA and verification in [release evidence](../qa/evidence.json). Publish an immutable application tag for an authorized release. Use the [versioning policy](versioning.md) for template tags and provenance.

For an authorized rollback, identify the exact previously verified Hosting version in release history and confirm its SHA. Restore that version through Hosting release history or pinned Firebase CLI version promotion, then verify the restored SHA and assets. Rollback restores web content and configuration. Review provider state separately for rules, data and Functions.

## Other release boundaries

| Boundary | Procedure |
| --- | --- |
| Firestore rules and indexes | Verify deployed policy, backward compatibility, emulator tests, and the previous policy or index set. Deploy only the approved `firestore:rules` or `firestore:indexes` target to the identified project. Wait for needed indexes to become ready before rolling out dependent queries. |
| Receipt Storage rules | Verify the target bucket and test owner, second-account, signed-out and legacy cases. Use the approved Storage rules target and verify its release. |
| Firebase Auth | Verify providers and authorized domains on the target project. Capture an authorized sign-in smoke separately. |
| Functions | Follow the [callable skill](../skills/service-firebase-functions/SKILL.md). Verify the deployed entrypoint, source revision, region, secret names, model and rollback before a scoped Functions release. |
| REST API | Deploy the isolated `finbuddy-api` codebase before the first Hosting release that enables its rewrite. Follow the sequence below. |

## REST API and Hosting cutover

1. Validate the API using the [isolated emulator suite](api.md#local-verification). Review runtime identity access to Firestore, Firebase Auth user lookup, and reads from the FinBuddy receipt bucket. Confirm that the public HTTP invoker is allowed and that application auth denies unauthenticated finance requests.
2. With production authorization, install from `api/package-lock.json` and deploy the checked source with `npx --yes firebase-tools@15.37.0 deploy --config firebase.api.json --only functions:finbuddy-api --project finbuddy-2025`. The isolated configuration lists only the API codebase.
3. Verify the deployed function with `node scripts/verify-api.mjs https://asia-south1-finbuddy-2025.cloudfunctions.net/finbuddyApi`. Then allow the verified Hosting artifact to publish its `/api/v1/**` rewrite. The Hosting workflow repeats the same checks through the public site. Open Swagger and run the authorized token smoke with a dedicated synthetic account.
4. Record the function revision and Hosting version as separate release identities. To roll back, restore the previous Hosting version and, when the API changed, restore the corresponding verified function revision separately.

For non-expiring tokens, deploy the API before the Settings update. The previous function and Settings bundle expect a timestamp for every token. Once an account has a non-expiring token with `expiresAt: null`, keep a compatible API and Settings revision when recovering from a release issue. This schema change needs no Firestore backfill.

Use Firebase CLI `15.37.0` for the API and `15.37.0` for Hosting. Avoid project-wide deployments from this checkout. Review [cost and quotas](../skills/project-finops/SKILL.md) if a release changes resource consumption.
