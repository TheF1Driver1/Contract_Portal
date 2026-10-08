"use client";

import { createContext, useContext } from "react";
import type { ContractTemplate, Property, Tenant, UserSectionTemplate } from "@/lib/types";
import type { LocalSection } from "./form-utils";

/** Builder state that lives outside react-hook-form (co-tenants, clauses, recipients). */
export interface BuilderData {
  properties: Property[];
  tenants: Tenant[];
  templates: ContractTemplate[];
  userTemplates: UserSectionTemplate[];
  coTenantIds: string[];
  setCoTenantIds: (next: string[]) => void;
  coTenantSignatures: string[];
  setCoTenantSignatures: (next: string[]) => void;
  sections: LocalSection[];
  setSections: (next: LocalSection[]) => void;
  landlordEmail: string;
  setLandlordEmail: (v: string) => void;
  goToStep: (step: number) => void;
}

export const BuilderContext = createContext<BuilderData | null>(null);

export function useBuilder(): BuilderData {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error("useBuilder must be used inside ContractBuilder");
  return ctx;
}
