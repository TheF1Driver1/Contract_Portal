import type { InvestmentAnalysis, InvestmentMetrics } from "./types";

// Average effective property tax rates by state (%)
export const STATE_TAX_RATES: Record<string, number> = {
  AL: 0.41, AK: 1.04, AZ: 0.62, AR: 0.61, CA: 0.73, CO: 0.51,
  CT: 1.79, DE: 0.57, FL: 0.89, GA: 0.87, HI: 0.32, ID: 0.69,
  IL: 2.27, IN: 0.85, IA: 1.57, KS: 1.33, KY: 0.86, LA: 0.55,
  ME: 1.09, MD: 1.09, MA: 1.17, MI: 1.54, MN: 1.12, MS: 0.65,
  MO: 0.97, MT: 0.84, NE: 1.73, NV: 0.59, NH: 2.18, NJ: 2.49,
  NM: 0.78, NY: 1.72, NC: 0.82, ND: 0.98, OH: 1.53, OK: 0.87,
  OR: 0.97, PA: 1.58, RI: 1.53, SC: 0.57, SD: 1.08, TN: 0.71,
  TX: 1.80, UT: 0.57, VT: 1.90, VA: 0.82, WA: 0.98, WV: 0.58,
  WI: 1.73, WY: 0.61, PR: 0.30,
};

export function calcMortgage(
  principal: number,
  annualRatePct: number,
  termYears: number
): number {
  if (annualRatePct === 0) return principal / (termYears * 12);
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function calcMetrics(
  a: InvestmentAnalysis,
  state?: string | null
): InvestmentMetrics {
  const price = a.purchase_price;
  const down = price * (a.down_payment_pct / 100);
  const closingCosts = price * (a.closing_cost_pct / 100);
  const totalUpfront = down + closingCosts;
  const loanAmount = price - down;

  const monthlyMortgage = calcMortgage(loanAmount, a.mortgage_rate_pct, a.loan_term_years);

  // Use state lookup if annual_tax_pct is the default (1.1) and a state is provided
  const taxPct =
    state && STATE_TAX_RATES[state.toUpperCase()]
      ? STATE_TAX_RATES[state.toUpperCase()]
      : a.annual_tax_pct;

  const monthlyTax         = (price * taxPct / 100) / 12;
  const monthlyInsurance   = (price * a.annual_insurance_pct / 100) / 12;
  const monthlyMaintenance = (price * a.maintenance_pct / 100) / 12;

  const totalMonthlyExpenses =
    monthlyMortgage +
    monthlyTax +
    monthlyInsurance +
    monthlyMaintenance +
    a.monthly_hoa +
    a.monthly_utilities;

  const rent = a.estimated_rent ?? 0;
  const effectiveRent = rent * (1 - a.vacancy_rate_pct / 100);

  const monthlyCashFlow = effectiveRent - totalMonthlyExpenses;
  const annualCashFlow  = monthlyCashFlow * 12;

  // NOI excludes mortgage (debt service)
  const annualOperatingExpenses =
    (monthlyTax + monthlyInsurance + monthlyMaintenance + a.monthly_hoa + a.monthly_utilities) * 12;
  const annualNOI = effectiveRent * 12 - annualOperatingExpenses;

  const capRate              = price > 0 ? (annualNOI / price) * 100 : 0;
  const cashOnCash           = totalUpfront > 0 ? (annualCashFlow / totalUpfront) * 100 : 0;
  const grossRentMultiplier  = rent > 0 ? price / (rent * 12) : 0;
  const breakEvenRent        = effectiveRent > 0
    ? totalMonthlyExpenses / (1 - a.vacancy_rate_pct / 100)
    : totalMonthlyExpenses;

  return {
    down_payment:           down,
    closing_costs:          closingCosts,
    total_upfront:          totalUpfront,
    loan_amount:            loanAmount,
    monthly_mortgage:       monthlyMortgage,
    monthly_tax:            monthlyTax,
    monthly_insurance:      monthlyInsurance,
    monthly_maintenance:    monthlyMaintenance,
    monthly_hoa:            a.monthly_hoa,
    monthly_utilities:      a.monthly_utilities,
    total_monthly_expenses: totalMonthlyExpenses,
    effective_monthly_rent: effectiveRent,
    monthly_cash_flow:      monthlyCashFlow,
    annual_cash_flow:       annualCashFlow,
    cap_rate:               capRate,
    cash_on_cash:           cashOnCash,
    gross_rent_multiplier:  grossRentMultiplier,
    break_even_rent:        breakEvenRent,
  };
}
