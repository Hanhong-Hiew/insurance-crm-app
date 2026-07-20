export type CommissionRule = {
  fixed_percent: number | string | null;
  payee_id: string;
  payee_name?: string | null;
  rule_type:
    | "net_commission_share"
    | "fixed_percent_of_gross"
    | "remaining_net_after_fixed_percent"
    | "equal_net_share";
  share_percent: number | string | null;
  subtract_percent: number | string | null;
};

export type CommissionPreviewRow = {
  amount: number;
  calculation_percent: number;
  payee_id: string;
  payee_name: string;
};

export function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateCommissionRows({
  grossPremium,
  netCommissionPercent,
  netPremium,
  rules,
}: {
  grossPremium: number;
  netCommissionPercent: number;
  netPremium: number;
  rules: CommissionRule[];
}): CommissionPreviewRow[] {
  if (!grossPremium || !netCommissionPercent || !rules.length) return [];

  const equalRuleCount =
    rules.filter((rule) => rule.rule_type === "equal_net_share").length || 1;
  const totalNetCommissionAmount = grossPremium * netCommissionPercent;
  const fixedNetPremiumAmount = rules
    .filter((rule) => rule.rule_type === "fixed_percent_of_gross")
    .reduce((total, rule) => total + netPremium * toNumber(rule.fixed_percent), 0);

  return rules.map((rule) => {
    let calculationPercent = 0;
    let amount = 0;

    if (rule.rule_type === "net_commission_share") {
      calculationPercent = netCommissionPercent * toNumber(rule.share_percent);
      amount = grossPremium * calculationPercent;
    } else if (rule.rule_type === "fixed_percent_of_gross") {
      calculationPercent = toNumber(rule.fixed_percent);
      amount = netPremium * calculationPercent;
    } else if (rule.rule_type === "remaining_net_after_fixed_percent") {
      amount = Math.max(totalNetCommissionAmount - fixedNetPremiumAmount, 0);
      calculationPercent = grossPremium ? amount / grossPremium : 0;
    } else if (rule.rule_type === "equal_net_share") {
      calculationPercent = netCommissionPercent / equalRuleCount;
      amount = grossPremium * calculationPercent;
    }

    return {
      amount: roundMoney(amount),
      calculation_percent: calculationPercent,
      payee_id: rule.payee_id,
      payee_name: rule.payee_name || "Payee",
    };
  });
}
