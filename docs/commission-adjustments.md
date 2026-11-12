# Commission Adjustments and Save Fixes

## Deployment Order

Run the entire `supabase/commission_adjustments_2026_11_12.sql` in Supabase SQL Editor, then deploy the app through the existing GitHub/Vercel connection. The previous policy-accuracy migration must already have been applied. Do not rerun the older migration after this one, because it contains older function definitions.

No live database changes were performed by the coding agent. The new migration performs no data updates or deletes. It is rerunnable and preserves existing commission rows, statement items and statement headers.

## Nullable Columns

- `commissions.entry_kind`: `adjustment` identifies a separate fixed-amount row; null retains normal legacy behaviour.
- `commissions.adjustment_note`: the required adjustment explanation.
- `commission_payment_items.entry_kind_snapshot` and `adjustment_note_snapshot`: immutable statement snapshots for future payments. Existing statement items remain null.
- `commission_payment_batches.has_adjustments`: permits signed statement totals when adjustments are included. Existing headers remain null.

There are no new tables. The statement view appends new snapshot columns without changing existing column positions. Existing nonnegative checks are retained for normal rows and extended to permit signed adjustments. If a legacy unique policy/payee constraint exists, it is replaced with the same uniqueness rule for calculated rows only.

## Behaviour

- Add a fixed RM adjustment from the Commissions section on a policy. Amounts accept a minus sign and at most two decimals; excess precision is rejected rather than silently rounded. Each save creates a separate row unless explicitly editing that unpaid adjustment.
- An adjustment can be entered as Unpaid or Paid. Paid requires a paid date. A paid adjustment is locked against amount/payee/note/status changes and deletion, enforced in PostgreSQL, not just hidden by the interface. Its paid date alone can be corrected.
- Normal commission recalculation and automatic cancellation clawbacks exclude adjustment rows entirely. A paid normal row for the same payee does not prevent adding or paying a new adjustment.
- Unpaid adjustments are eligible for payment even when the policy premium is not marked Paid, because corrections/clawbacks may be needed after cancellation. Normal commissions retain the premium-paid requirement.
- The payment page reads commissions and statement rows in pages rather than silently cutting off at the old list limit.
- Confirm Paid groups selected rows by payee and creates all statement headers, items, note snapshots and paid-status updates in one transaction. Duplicate/repeated selections are rejected. Signed amounts can reduce or make a statement total negative; no existing statements are rewritten.
- Paid-date corrections change only the commission's paid date. Amount, status, statement link and original statement dates/snapshots stay unchanged. This is deliberately a row-level correction, not a statement reissue.
- The detail-page toggle returns visible success/error feedback and refreshes the same detail page. Marking paid leaves already-paid rows and dates untouched. Unmarking affects normal rows only; paid adjustments remain locked. The old `/protected/commissions` address redirects to `/protected/commission-payments`.
- Policy history records adjustment add/edit/delete, paid-date/status changes, every policy/risk-detail field update and shared client/address/vehicle changes against linked policies. New motor-detail rows also log NCD, including zero.
- Policy forms use explicit client submission rather than React's automatic form-action reset, retaining all entered fields on warnings/errors. Successful edits navigate back to the policy detail page. New-policy success keeps its existing clear-form/success-message behaviour.
- NCD display is rounded to two decimal places maximum. Currency inputs display comma grouping and two decimal places when not being edited.

## Verification

Run `node tests/policy-accuracy.test.mjs`. To include PostgreSQL tests, set `KOVER_PGLITE_MODULE` to the absolute path of an installed PGlite module. It remains test-only, not an app dependency.

Tests verify nullable additions, migration reruns, unchanged old row/statement values, exact signed amounts, multiple adjustments for one payee, exclusion from recalculation, unpaid edit/delete, paid database locks, date-only correction, preserved statement links and snapshots, payment atomicity, repeat-payment rejection and field history. Helper/source tests cover zero values, money padding, floating-point NCD display, retained-form submission and PDF adjustment notes.

A generated adjustment PDF was rendered and checked with a negative amount and wrapped note. The local browser preview was blocked by local file-watcher/compilation problems, so interactive browser and production-build checks remain unconfirmed. Live Supabase records have not been inspected or migrated.
