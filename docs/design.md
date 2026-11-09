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

- Lavender primary, tonal surfaces, and explicit on-color, outline, error and success roles in both themes. Roboto Variable is bundled locally. The theme preference applies immediately and persists in the browser.
- Compact screens use a bottom navigation bar and floating Add expense button. Medium screens use a compact rail. Expanded screens use a labeled rail and extended button. Home, Expenses, and Savings are the primary destinations. Home links to Bills & EMIs, and More groups it with Budgets, Overview, Recurring, Categories, People, Metrics Explorer, KautilyaAI, and account actions.
- Shared Material controls cover filled, tonal, outlined and text buttons, cards, text fields, chips, tabs, menus, switches, progress, tables, dialogs, sheets, and snackbars. The expense form becomes a bottom sheet on phones. Charts use the same roles as the app.
- The ledger groups transactions by day and exposes search, date presets, category, person, and sort filters. Tapping a row edits it. Its overflow menu opens the receipt or asks for confirmation before deletion.
- Focus returns to the initiating control after dismissing the expense form. Validation gives feedback next to the form actions and moves focus to the required field. Error, pending, and empty states use the same components.

[Material 3 color roles](https://m3.material.io/styles/color/the-color-system/) · [Material 3 typography](https://m3.material.io/styles/typography/applying-type) · [Material 3 lists](https://m3.material.io/components/lists/overview)

## Data and release

The web app retains the existing account IDs and ledger paths. Income, schedules, holdings and payment markers use new collections under the existing owner-scoped `users/{uid}` boundary. A Firestore transaction updates the payment marker and its expense together. Records with a historical category, platform, or receipt remain editable. Help and legal content live under the documentation site.

See [testing](testing.md) for the emulator scenarios and [the release plan](release-plan.md) for Hosting delivery.
