# FinBuddy security policy

Report a suspected vulnerability using GitHub's private vulnerability reporting form. Include the affected component and version, expected and observed behavior, and the impact. Use a sample account or synthetic records for any evidence. [Report a vulnerability privately](https://github.com/theharithsa/finbuddy/security/advisories/new)

Keep account details, receipts, statements, authentication tokens, and other sensitive material out of public issues, screenshots, and logs. Use the ordinary issue forms for bugs that can be discussed publicly. [Public issue forms](https://github.com/theharithsa/finbuddy/issues/new/choose)

## Account and data boundaries

- Firebase Authentication provides sign-in. Firestore rules scope private user documents to their owner. Categories explicitly published to the shared catalog can be read by signed-in users.
- Receipt attachments use Firebase Storage. The REST API checks receipt ownership before serving a download.
- Developer Options creates scoped personal API tokens. The API stores token digests. Keep the original token in your integration's secret store and revoke it from Settings when access should end. [API authentication and scopes](docs/api.md)
- The public product site and demo show synthetic household data. Use Firebase emulators to verify account and data changes. [Testing guide](docs/testing.md)

For operational details, see the [service inventory](docs/services.md) and [release and rollback guide](docs/release-plan.md).
