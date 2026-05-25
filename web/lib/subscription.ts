import type { SubscriptionPlan } from "@/lib/types";
import { PLAN_LIMITS } from "@/lib/types";

export function canAddProperty(plan: SubscriptionPlan, currentCount: number): boolean {
  return currentCount < PLAN_LIMITS[plan].max_properties;
}

export function canSendSMS(plan: SubscriptionPlan): boolean {
  return PLAN_LIMITS[plan].sms;
}

export function canExportScheduleE(plan: SubscriptionPlan): boolean {
  return PLAN_LIMITS[plan].schedule_e;
}

export function canInviteManager(plan: SubscriptionPlan, currentManagerCount: number): boolean {
  return currentManagerCount < PLAN_LIMITS[plan].managers;
}

export function canUploadTemplate(plan: SubscriptionPlan): boolean {
  return plan !== 'free';
}

export function canAccessMarket(plan: SubscriptionPlan): boolean {
  return plan !== 'free';
}

export function canExportExpenses(plan: SubscriptionPlan): boolean {
  return plan !== 'free';
}

export function getUpgradeMessage(feature: string, requiredPlan: SubscriptionPlan): string {
  const planNames: Record<SubscriptionPlan, string> = {
    free: 'Gratis',
    propietario: 'Propietario',
    inversionista: 'Inversionista',
    enterprise: 'Enterprise',
  };
  return `Esta función requiere el plan ${planNames[requiredPlan]} o superior. Actualiza tu plan para acceder a ${feature}.`;
}

export function planDisplayName(plan: SubscriptionPlan): string {
  const names: Record<SubscriptionPlan, string> = {
    free: 'Gratis',
    propietario: 'Propietario',
    inversionista: 'Inversionista',
    enterprise: 'Enterprise',
  };
  return names[plan];
}

// Legacy helpers kept for backward compatibility
export { PLAN_LIMITS };
export function canUseSMS(plan: SubscriptionPlan): boolean { return PLAN_LIMITS[plan].sms; }
export function getMaxProperties(plan: SubscriptionPlan): number { return PLAN_LIMITS[plan].max_properties; }
export function getMaxContractsPerMonth(plan: SubscriptionPlan): number { return PLAN_LIMITS[plan].max_contracts_per_month; }
export function getMaxManagers(plan: SubscriptionPlan): number { return PLAN_LIMITS[plan].managers; }

export const PLAN_PRICES_USD: Record<Exclude<SubscriptionPlan, 'enterprise'>, number> = {
  free: 0,
  propietario: 29,
  inversionista: 99,
};
