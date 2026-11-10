# API continuation

- [Issue #119](https://github.com/theharithsa/finbuddy/issues/119) completed in [PR #120](https://github.com/theharithsa/finbuddy/pull/120). The first production API revision was `finbuddyapi-00001-sav` in `asia-south1`. Direct and Hosting API smoke checks passed. A synthetic signed-in browser test generated and revoked a token in production.
- [Issue #122](https://github.com/theharithsa/finbuddy/issues/122) adds optional non-expiring tokens. Deploy the API before the sidebar update and retain a null-aware API and Settings revision for recovery after non-expiring credentials are issued.
- Source includes the HTTP API, Swagger UI, shared finance and token contracts, and Settings Developer Options.
- The [application workflow](../../.github/workflows/finbuddy.yml) runs the API contract and isolated emulator suites. Review the current PR head checks for evidence.
- The Gen 2 release uses the dedicated `finbuddy-api` codebase in `asia-south1`. Release it before publishing the Hosting rewrite.
- Dynatrace API runtime export is optional and remains unverified in production. The CI observer uses a separate credential and service identity.
