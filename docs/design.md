# FinBuddy Material 3 design

FinBuddy opens on Home for a monthly money check-in. Add expense is available across the workspace and requires an amount and category. Today and Cash are the defaults. The optional note stays in view. Date, platform, people, and receipts sit under More details. Recurring templates open the same form with their values filled in.

## Household money check-in

| Question | What a household records |
| --- | --- |
| What came in? | A received amount. The date defaults to today and a label such as Salary is optional. |
| What went out? | An amount and category for an expense. |
| What do we still need to pay? | A name, expected amount and due date for rent, school fees, an EMI or another bill. Regular bills can repeat monthly or yearly. |
| What have we set aside? | A name and the latest value for savings or an investment. The type and value date are optional. |

Home shows the recorded income minus logged expenses and unpaid bills due through the selected month. This figure is an estimate based on the entries in FinBuddy. Earlier unpaid occurrences carry forward. A bill payment creates one expense or links an existing expense, and the resulting payment status follows that ledger entry. Shorter months use their last day for repeating due dates. A past month applies the dates of the current records.

Savings and investments use manually entered INR values, each with its own as-of date. These values sit separately from the monthly cash calculation. KautilyaAI shows Coming soon while the tracking features are in focus.

[SEBI on managing income and expenses](https://investor.sebi.gov.in/moneymatters-inc-exp.html) · [RBI Financial Awareness booklet](https://www.rbi.org.in/commonperson/images/FAME202426022024.pdf)

## Design system

- Settings offers light, dark and system display modes, five Material color palettes and locally bundled fonts. Google Sans and Lavender are the defaults. Appearance applies immediately and persists on the device.
- A purple Indian palm squirrel holding a rupee coin is the FinBuddy mark. The favicon, wordmark, touch and install icons use the same mascot. App destinations, form actions and built-in categories use the matching rounded SVG set.
- On wider screens, the app bar holds Home, Expenses, Savings, More, and Add expense. On phones, the destinations move to the bottom bar with a reachable Add expense button. More groups money tools and account options.
- Home leads with one balance estimate and a three-row calculation. Bills and expenses use lightly divided lists. The savings section keeps a softer surface and the FinBuddy mascot.
- Short entrance transitions give page and form changes a sense of continuity. Control states and disclosures animate briefly. The page and form motion turns off when the system requests reduced motion.
- Shared Material controls cover filled, tonal, outlined and text buttons, cards, text fields, chips, tabs, menus, switches, progress, tables, dialogs, sheets, and snackbars. The expense form becomes a bottom sheet on phones. Charts use the same roles as the app.
- The ledger groups transactions by day and exposes search, date presets, category, person, and sort filters. Tapping a row edits it. Its overflow menu opens the receipt or asks for confirmation before deletion.
- Focus returns to the initiating control after dismissing the expense form. Validation gives feedback next to the form actions and moves focus to the required field. Error, pending, and empty states use the same components.

[Material 3 color roles](https://m3.material.io/styles/color/the-color-system/) · [Material 3 typography](https://m3.material.io/styles/typography/applying-type) · [Material 3 lists](https://m3.material.io/components/lists/overview)

The layout takes its restrained surfaces and clear selection states from Dynatrace Strato. Copilot Money and Monarch inform the separation between a quick money check-in and deeper reports. Material 3 guides the interaction states and motion. [Dynatrace’s Strato refresh](https://www.dynatrace.com/news/blog/a-design-refresh-for-every-dynatrace-app-including-yours/) · [Copilot Money for Web](https://help.copilot.money/en/articles/11780342-copilot-money-for-web) · [Getting started with Monarch](https://help.monarch.com/hc/en-us/articles/360048393272-Getting-Started-with-Monarch) · [Material motion](https://m3.material.io/styles/motion)

For another React app, reuse the appearance options in `src/lib/appearance.ts`, the provider in `src/contexts/ThemeContext.tsx` and the Material palette tokens. Set an app-specific storage key to keep its browser preferences separate.

## Data and release

The web app retains the existing account IDs and ledger paths. Income, schedules, holdings and payment markers use new collections under the existing owner-scoped `users/{uid}` boundary. A Firestore transaction updates the payment marker and its expense together. Records with a historical category, platform, or receipt remain editable. Help and legal content live under the documentation site.

See [testing](testing.md) for the emulator scenarios and [the release plan](release-plan.md) for Hosting delivery.
