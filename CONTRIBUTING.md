# Contributing to FinBuddy

Start with a [GitHub issue](https://github.com/theharithsa/finbuddy/issues/new/choose) and check the [Project board](https://github.com/users/theharithsa/projects/1) for existing work. Describe the behavior, the expected result, and how to verify it.

1. Work on a branch from `main` and keep the change focused on the linked issue.
2. Use Node.js 24 for the web app, Python 3.12 for the public documentation build, and `npm ci` to install locked dependencies. The API runs on Node.js 22.
3. Use the public demo for screenshots and Firebase emulators for account and data changes. Use fictional records in screenshots, logs, and test fixtures. See the [testing guide](docs/testing.md) for emulator setup and checks.
4. Run the checks that cover your change. Use `sh scripts/check.sh` for foundation checks and see the [testing guide](docs/testing.md) for web and API checks.
5. Open a PR with the checks you ran. Use `Closes #123` when it fully resolves the issue. Fill out **Documentation impact** with `Updated: <guides>` or `No change: <reason>`. See the [FinBuddy SDLC](docs/sdlc.md) for the merge and release steps.

Edit the guides, roadmap, and release history in [the handbook source](docs/public-guides.json). `npm run dev` builds the Firebase Help Center guides before serving the app. Open `/docs/` to preview them. The Pages landing page lives in `site/`. Build the Pages preview with `python scripts/build_public_docs.py --output dist/public-docs` and serve it with `python -m http.server 8080 --directory dist/public-docs`. Use an empty build output directory. Product screenshots come from FinBuddy's fictional household demo.

Use the [security policy](SECURITY.md) to report suspected vulnerabilities.
