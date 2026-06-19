import React from "react";

import { CurrentMembership, MembershipPlan } from "../../services/membershipService";

export type PlanTier = "day" | "monthly" | "annual";

export type MembershipTierContent = {
  icon: React.ReactNode;
  fallbackPrice: number;
  unit: string;
  badge?: string;
  title: string;
  subtitle: string;
  features: string[];
};

export type MembershipBenefitCard = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
};

export type MembershipPageState = {
  plans: MembershipPlan[];
  currentMembership: CurrentMembership | null;
  selectedTier: PlanTier;
  isLoading: boolean;
  isRenewingPlanId: string | null;
  errorMessage: string | null;
};
