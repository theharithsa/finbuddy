# Contributing to FinBuddy

Start with a [GitHub issue](https://github.com/theharithsa/finbuddy/issues/new/choose) and check the [Project board](https://github.com/users/theharithsa/projects/1) for existing work. Describe the behavior, the expected result, and how to verify it.

1. Work on a branch from `main` and keep the change focused on the linked issue.
2. Use Node.js 24 for the web app and `npm ci` to install its locked dependencies. The API runs on Node.js 22.
3. Use the public demo for screenshots and Firebase emulators for account and data changes. Use fictional records in screenshots, logs, and test fixtures. See the [testing guide](docs/testing.md) for emulator setup and checks.
4. Run the checks that cover your change. For web changes, run `npm run lint -- --quiet`, `npm run test:run`, and `npm run build`. For docs changes, run `python scripts/check_links.py`.
5. Open a PR with a description of what changed and the checks you ran. Use `Closes #123` when the change fully resolves that issue.

The landing page lives in `site/`. Preview it locally with `python -m http.server 8080 --directory site`. Product screenshots come from FinBuddy's fictional household demo.

Use the [security policy](SECURITY.md) to report suspected vulnerabilities.
