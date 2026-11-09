# FinBuddy Material 3 design

FinBuddy opens on Expenses. The primary action opens a form with amount and category as the required inputs. Today and Cash are the defaults. The optional note stays in view. Date, platform, people, and receipts sit under More details. Recurring templates open the same form with their values filled in.

## Design system

- Lavender primary, tonal surfaces, and explicit on-color, outline, error and success roles in both themes. Roboto Variable is bundled locally. The theme preference applies immediately and persists in the browser.
- Compact screens use a bottom navigation bar and floating Add expense button. Medium screens use a compact rail. Expanded screens use a labeled rail and extended button. Expenses, Overview, and Budgets are the primary destinations. The More drawer groups Recurring, Categories, People, Metrics Explorer, KautilyaAI, and account actions.
- Shared Material controls cover filled, tonal, outlined and text buttons, cards, text fields, chips, tabs, menus, switches, progress, tables, dialogs, sheets, and snackbars. The expense form becomes a bottom sheet on phones. Charts use the same roles as the app.
- The ledger groups transactions by day and exposes search, date presets, category, person, and sort filters. Tapping a row edits it. Its overflow menu opens the receipt or asks for confirmation before deletion.
- Focus returns to the initiating control after dismissing the expense form. Validation gives feedback next to the form actions and moves focus to the required field. Error, pending, and empty states use the same components.

[Material 3 color roles](https://m3.material.io/styles/color/the-color-system/) · [Material 3 typography](https://m3.material.io/styles/typography/applying-type) · [Material 3 lists](https://m3.material.io/components/lists/overview)

## Data and release

The web app retains the same account IDs and Firestore, Storage, and callable contracts. Editing uses the same form as adding an expense. Records with a historical category, platform, or receipt remain editable. This design covers the account and workspace interfaces. Help and legal content live under the documentation site.

See [testing](testing.md) for the emulator scenarios and [the release plan](release-plan.md) for Hosting delivery.
