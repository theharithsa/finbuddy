# Firebase Functions continuation

Dependency maintenance for [#173](https://github.com/theharithsa/finbuddy/issues/173) on 20 November 2026 updates the maintained source package to Firebase Admin `14.5.1` and Functions `7.4.0`, removes the unused `firebase-functions-test`, and refreshes patched indirect packages. The Node 22 build and source audit passed locally with zero audit findings. Current-head CI and integrated release evidence belong to #173/#174. This does not deploy or establish the source of the existing callable.

Inspected source at `22fdc36bf8e6f7aa2f2a31f9b394dcb04575b115` on 10 November 2026. The Firebase CLI lists the live `chatWithKautilya` Gen 2 entrypoint, Node.js 22, `us-central1`. This establishes deployment metadata.

- The checked-in exports are `chatWithGemini` and `getFinancialInsights`. The active web route is Coming soon. The historical source declares the `GEMINI_API_KEY` secret by name.
- The historical Functions package build passed locally. The Hosting rollout was separate from Functions. Callable response, live source revision, invocation volume and Dynatrace tenant ingestion require separate evidence.
- [Issue #127](https://github.com/theharithsa/finbuddy/issues/127) updates the historical `node-forge`, `protobufjs`, and `fast-xml-parser` lockfile entries. These versions describe the checked source package.
- Before a callable release, reconcile an authorized source revision, verify owner-only access and safe model inputs in tests, review provider model availability and quotas, and record the exact deployed function revision and rollback artifact.
