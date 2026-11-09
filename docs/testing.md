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
| FIN-01 | Create an account, validate quick entry and save with today’s date |
| FIN-05 | Save an expense with platform and synthetic receipt, reload, navigate months, search, edit, view the receipt and confirm deletion |
| FIN-02 | Open each workspace destination, verify reduced motion and keyboard dismissal, toggle and restore dark mode, and sign out at 390 × 844 |
| FIN-03 | Check leap month, local month boundaries, legacy ISO dates and paise arithmetic |
| FIN-04 | Verify exact deployed revision, immutable JavaScript, favicon, touch icon, install icons and shortcut images from Hosting |
| FIN-06 | Record income, link an existing bill payment, add another payment, and verify that savings stay separate after reload |
| FIN-07 | Submit concurrent payments, verify one ledger entry, and reject a different account’s read |
| FIN-08 | Carry overdue bills forward, handle short months and leap years, and restore an unpaid bill if its expense is removed |
| FIN-09 | Apply a bundled font, switch palettes and display mode, verify settings at phone width, reload, and reset appearance |
| FIN-10 | Open the public demo, check insight tiles and footer placement, and verify the demo makes no Firebase account requests |
| FIN-11 | Render a synthetic profile photo and restore initials if the image fails |

Live Google sign-in, tenant signal searchability and model responses require distinct verification. The [release plan](release-plan.md) describes the boundary between emulator and Hosting evidence.
