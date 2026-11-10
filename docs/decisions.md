# FinBuddy decisions

| Area | Decision | Evidence or rationale |
| --- | --- | --- |
| Product | Household Home, quick expenses, bills and EMIs, and dated savings and investment values. Park KautilyaAI behind Coming soon. | Household tracking request and issue [#111](https://github.com/theharithsa/finbuddy/issues/111) |
| Stack | React, Vite and TypeScript with Firebase Auth, Firestore and Storage | Existing application and data contract. FinBuddy stores private data under `users/{uid}`. |
| Hosting | Firebase Hosting site `finbuddy-2025` | Firebase site and app records match the project supplied for FinBuddy. FinVision has a separate site in the project. |
| Design | Material 3, personalized palettes, a top app bar and phone navigation, and a single focal balance on Home | User requested a consumer finance experience and pointed to Dynatrace as a design reference. |
| Privacy | Same Firebase identity and document paths. Browser operation instrumentation carries fixed action names and bounded error codes. | Application data remains on existing paths. Public library capabilities require verified provider rules. The audit could not confirm deployed rules parity. |
| Observability | Dynatrace, with browser instrumentation gated on approved capture settings and explicit opt-in | User requested dt-obs. Tenant verification and enablement are pending. |
| Repository | Existing public repository and MIT license. Adoption through a reviewed PR. | Repository settings require an approving review. |
