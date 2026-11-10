---
name: service-firebase-data
description: Maintain FinBuddy Firebase Auth boundaries, Firestore records and indexes, and receipt storage and rules.
---

# FinBuddy Firebase data

Read the [continuation](continuation.md) and [test catalog](../../docs/testing.md). `src/lib/firebase.ts` and `src/lib/household-firestore.ts` implement browser data access. The root `firestore.rules`, `firestore.indexes.json`, `storage.rules` and `firebase.json` define the checked-in provider contract.

- Preserve Firebase UIDs and private documents under `users/{uid}`. Validate legacy dates and receipt references. Store household amounts as integer paise and keep the existing INR ledger conversion at the boundary.
- Use the household transaction when recording or linking bill payments. A linked payment and its ledger entry represent one expense.
- Keep Auth domain and provider settings separate from Hosting releases. Test signed-out and second-account access, including receipt paths and all applicable rules. A browser-generated owner path alone is insufficient evidence of isolation.
- Review deployed policy and known-client compatibility before changing rules or indexes. Use only the authorized target and the scoped rule or index release described in the [release plan](../../docs/release-plan.md).
- Check index and listener effects, reconnect reads and receipt byte/operation costs with [FinOps](../project-finops/SKILL.md).
