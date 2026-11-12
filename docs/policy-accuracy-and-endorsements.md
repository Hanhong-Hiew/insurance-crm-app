# Policy Accuracy and Endorsements

## Deployment

1. Take the usual Supabase database backup.
2. Run the complete `supabase/policy_accuracy_endorsements_2026_11_11.sql` in Supabase SQL Editor before deploying the app.
3. Commit and push the application changes, then check the Vercel deployment.
4. Open an existing policy and compare its gross, total, NCD and paid commissions with the pre-deployment values. Test new entries using a clearly identified test policy.

The migration is additive and rerunnable. It does not update or delete existing records, backfill premiums, recalculate old commissions, drop columns, or change existing view column order. All added policy columns are nullable. Existing gross and total remain the fallback until an explicit premium edit or endorsement establishes the original-premium snapshot.

## Database Changes

`policy_terms` gains these nullable columns:

| Purpose | Columns |
| --- | --- |
| Premium breakdown | `basic_premium`, `ncd_amount`, `service_tax`, `stamp_duty`, `total_payable_override`, `typical_premium_rate` |
| Documents and product | `cover_note_number`, `issue_date`, `product_name` |
| Motor / finance | `financial_interest`, `seating_capacity`, `transferred_from_policy_term_id` |
| Original amounts | `original_gross_premium`, `original_total_premium` |
| Cancellation | `cancellation_date`, `refund_amount`, `gross_refund_amount` |

`insurance_types.typical_premium_rate` is a nullable default benchmark. Rates are stored as fractions and entered as percentages. Configure appropriate benchmarks in Settings; no universal insurance pricing rate is assumed.

Existing `policy_terms.gross_premium` and `total_premium` are reused for current amounts. Existing `motor_policy_details.ncd` is reused; zero is valid and displays as `0%`.

New tables:

- `policy_endorsements`: policy link, endorsement number, issue/effective dates, description, signed premium/tax/net changes, settlement status and creation metadata.
- `policy_change_history`: policy link, field, old/new JSON values, date and actor. Database triggers automatically capture premium, document number, NCD and cancellation edits.
- `policy_commission_clawbacks`: cancellation-related recovery amounts per original commission/payee. These are separate from paid commission and statement history.

New authenticated RPCs save financial changes and endorsements atomically, find duplicates and find transfer candidates. Supporting indexes and read policies are added. New-table writes go through authenticated RPCs rather than direct browser writes. The main policy view retains every existing column and appends new metadata only when absent.

## Behaviour

- Total Payable defaults to Gross + Service Tax + Stamp Duty. Override permits insurer rounding. Differences over RM1 and unusually low gross premiums require an explicit acknowledgement before save.
- Low-premium detection requires both Sum Insured and a benchmark rate. It flags gross below 20% of Sum Insured multiplied by that rate; it is a warning, not a pricing recommendation.
- All commissions use current Gross Premium and saved policy rate snapshots. New forms no longer accept separately typed commission amounts. Existing custom rows are not rewritten by this migration.
- Premium/split/risk changes with existing commissions require Update or Keep. Update recalculates unpaid rows only; paid rows and previous statements remain untouched. Different old/new unpaid payees require review rather than destructive replacement.
- Endorsements require known original Gross Premium and Total Payable; missing legacy amounts must be entered explicitly first. Endorsements preserve original premiums; current premiums add all signed endorsement changes, independently of settlement status. Settled endorsements must first be returned to Pending before changing their amounts. No delete function is added, to preserve history.
- Cancellation needs a cancellation date. Total Refund and Gross Premium Refunded are separate because commission must not be calculated on refunded tax or stamp duty. Clawback uses Gross Premium Refunded multiplied by each saved commission rate. If that basis is missing, the detail page shows a warning instead of inventing an amount. Clawbacks are shown separately, not automatically netted against future statements.
- Duplicate warnings cover case-insensitive policy/cover-note numbers and normalized plates with overlapping terms. Blank, N/A and '-' numbers are ignored. A warning can be acknowledged for legitimate ownership transfers or overlaps.
- Transferred-from links are optional and validated against the same plate. Issue Date is available as a Records date basis, sort and monthly filter. Dates use dd/mm/yyyy.

## Verification

`node tests/policy-accuracy.test.mjs` tests percentage/currency helpers and warning boundaries. Set `KOVER_PGLITE_MODULE` to an installed PGlite module's absolute entry path to also run isolated PostgreSQL tests. PGlite is test-only and is not added as an application dependency.

Database tests cover migration reruns, unchanged legacy values/view columns, nullable additions, paid commission preservation, explicit update/keep, gross-based rates, signed endorsements, transaction rollback, settled protection, clawbacks, automatic history, duplicate matching and signed-out mutation rejection.

Validation on 12/11/2026: all 92 application source files passed a TypeScript semantic check; isolated PostgreSQL regression tests and `git diff --check` passed. Local preview and production builds stalled during compilation and were stopped, so production-build, lint and visual verification remain unconfirmed.

These are fixture-based compatibility tests, not a claim that the live Supabase database has been migrated or inspected.
