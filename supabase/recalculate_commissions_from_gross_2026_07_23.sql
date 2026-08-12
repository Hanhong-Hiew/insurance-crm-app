-- Recalculate existing unpaid, non-custom commission rows using gross premium only.
-- This fixes old rows that were previously calculated from net premium for H/C.
--
-- Safety:
-- - Paid commission rows are not changed.
-- - Custom commission rows are not changed.
-- - Existing policy term net_commission_percent is used as the commission rate snapshot.

begin;

with equal_rule_counts as (
  select
    split_pattern_id,
    count(*)::numeric as rule_count
  from public.commission_split_rules
  where rule_type = 'equal_net_share'
  group by split_pattern_id
),
fixed_rule_totals as (
  select
    split_pattern_id,
    coalesce(sum(fixed_percent), 0)::numeric as fixed_percent_total
  from public.commission_split_rules
  where rule_type = 'fixed_percent_of_gross'
  group by split_pattern_id
),
calculated as (
  select
    cm.id as commission_id,
    case
      when csr.rule_type = 'net_commission_share'
        then coalesce(pt.net_commission_percent, 0) * coalesce(csr.share_percent, 0)
      when csr.rule_type = 'fixed_percent_of_gross'
        then coalesce(csr.fixed_percent, 0)
      when csr.rule_type = 'remaining_net_after_fixed_percent'
        then greatest(
          coalesce(pt.net_commission_percent, 0) - coalesce(frt.fixed_percent_total, 0),
          0
        )
      when csr.rule_type = 'equal_net_share'
        then coalesce(pt.net_commission_percent, 0) / greatest(coalesce(erc.rule_count, 1), 1)
      else 0
    end as new_calculation_percent
  from public.commissions cm
  join public.policy_terms pt on pt.id = cm.policy_term_id
  join public.commission_split_rules csr
    on csr.split_pattern_id = cm.split_pattern_id
   and csr.payee_id = cm.payee_id
  left join fixed_rule_totals frt on frt.split_pattern_id = cm.split_pattern_id
  left join equal_rule_counts erc on erc.split_pattern_id = cm.split_pattern_id
  where cm.status = 'unpaid'
    and coalesce(cm.is_custom, false) = false
    and pt.gross_premium is not null
    and pt.net_commission_percent is not null
),
new_values as (
  select
    c.commission_id,
    c.new_calculation_percent,
    round((pt.gross_premium * c.new_calculation_percent)::numeric, 2) as new_amount
  from calculated c
  join public.commissions cm on cm.id = c.commission_id
  join public.policy_terms pt on pt.id = cm.policy_term_id
),
changed_rows as (
  update public.commissions cm
  set
    auto_calculation_percent = nv.new_calculation_percent,
    calculation_percent = nv.new_calculation_percent,
    auto_amount = nv.new_amount,
    amount = nv.new_amount,
    unpaid_amount = nv.new_amount
  from new_values nv
  where cm.id = nv.commission_id
    and (
      abs(coalesce(cm.calculation_percent, 0) - nv.new_calculation_percent) > 0.000001
      or abs(coalesce(cm.amount, 0) - nv.new_amount) > 0.009
      or abs(coalesce(cm.unpaid_amount, 0) - nv.new_amount) > 0.009
    )
  returning
    cm.id,
    cm.policy_term_id,
    cm.payee_id,
    cm.calculation_percent,
    cm.amount,
    cm.unpaid_amount
)
select count(*) as recalculated_commission_rows
from changed_rows;

commit;
