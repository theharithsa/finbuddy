# FinBuddy release and rollback

## Web Hosting

1. Open an issue-linked PR and run the [checks](testing.md) for the exact head. Obtain the review required by GitHub and verify the merge commit.
2. For authorized preview review, build with `VITE_RELEASE_REVISION` set to the tested Git SHA. Reuse the approved preview channel for sign-in tests. Deploy with `--no-authorized-domains` to preserve the existing Auth list. Verify a new hostname and obtain authorization before editing Auth domains. Use emulators for synthetic writes.
3. The [main workflow](../.github/workflows/finbuddy.yml) tests the merged revision, uploads `finbuddy-hosting`, and deploys the same `dist/` artifact to the `finbuddy-2025` live channel. Its production environment uses the `FIREBASE_SERVICE_ACCOUNT_FINBUDDY_2025` secret by name. Manual promotion requires authorization and the tested Hosting version.
4. Verify the live SHA, cache headers and assets with `node scripts/verify-hosting.mjs https://finbuddy-2025.web.app <checked-git-sha>`. If the provider reports a completed release and the first check serves an older SHA, retry the read-only check up to three times over one minute. Preserve the original CI result and record the later observation separately.
5. Record the Hosting version and live release ID, the SHA and verification in [release evidence](../qa/evidence.json). Publish an immutable application tag for an authorized release. Use the [versioning policy](versioning.md) for template tags and provenance.

For an authorized rollback, identify the exact previously verified Hosting version in release history and confirm its SHA. Restore that version through Hosting release history or pinned Firebase CLI version promotion, then verify the restored SHA and assets. Rollback restores web content and configuration. Review provider state separately for rules, data and Functions.

## Other release boundaries

| Boundary | Procedure |
| --- | --- |
| Firestore rules and indexes | Verify deployed policy, backward compatibility, emulator tests, and the previous policy or index set. Deploy only the approved `firestore:rules` or `firestore:indexes` target to the identified project. Wait for needed indexes to become ready before rolling out dependent queries. |
| Receipt Storage rules | Verify the target bucket and test owner, second-account, signed-out and legacy cases. Use the approved Storage rules target and verify its release. |
| Firebase Auth | Verify providers and authorized domains on the target project. Capture an authorized sign-in smoke separately. |
| Functions | Follow the [callable skill](../skills/service-firebase-functions/SKILL.md). Verify the deployed entrypoint, source revision, region, secret names, model and rollback before a scoped Functions release. |
| Local MCP | Build and verify the [stdio adapter](../skills/service-mcp-server/SKILL.md) on the operator's machine. |

Use Firebase CLI `14.20.0` for the current reproducible path. Avoid project-wide deployments from this checkout. Review [cost and quotas](../skills/project-finops/SKILL.md) if a release changes resource consumption.
