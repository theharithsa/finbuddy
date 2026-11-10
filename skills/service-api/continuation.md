# API continuation

- Work item [#119](https://github.com/theharithsa/finbuddy/issues/119).
- Source includes the HTTP API, Swagger UI, shared finance and token contracts, and Settings Developer Options.
- The [application workflow](../../.github/workflows/finbuddy.yml) runs the API contract and isolated emulator suites. Review the current PR head checks for evidence.
- The Gen 2 release uses the dedicated `finbuddy-api` codebase in `asia-south1`. Release it before publishing the Hosting rewrite.
- Live API, production IAM, and Dynatrace runtime signals await an authorized production release and verification. The existing CI observer uses a separate credential and service identity.
