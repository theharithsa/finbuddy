# FinBuddy testing

Use Node.js 24, Python 3 and Java 21 for CI-equivalent checks. On Windows, put Git Bash on PATH for the foundation shell test. Install the repository lockfile with `npm ci`.

```sh
python scripts/check_foundation.py --ready
python scripts/check_links.py
python -m unittest discover -s tests
npm run lint -- --quiet
npm run test:run
npm run build
```

To run the real browser scenarios against Firebase Auth, Firestore and Storage emulators:

```sh
npx --no-install playwright install chromium
npx --yes firebase-tools@14.20.0 emulators:exec --only auth,firestore,storage --project demo-finbuddy "npm run test:browser"
```

For an installed Chrome channel, set `FINBUDDY_BROWSER_CHANNEL=chrome`. Browser fixtures create disposable Auth users and synthetic finance records under the demo project. Run only against the emulator. Playwright starts its own local Vite process.

| Case | Check |
| --- | --- |
| FIN-01 | Create an account, save an expense with a synthetic receipt, reload, move between months, search, edit and delete |
| FIN-02 | Exercise primary and secondary navigation and sign out on a mobile viewport |
| FIN-03 | Check leap month, local month boundaries, legacy ISO dates and paise arithmetic |
| FIN-04 | Verify exact deployed revision and immutable JavaScript from Hosting |

Live Google sign-in, tenant signal searchability and model responses require distinct verification. The [release plan](release-plan.md) describes the boundary between emulator and Hosting evidence.
