import { MembershipPlan } from "../../services/membershipService";

import { PlanTier } from "./types";

export function inferTier(plan: MembershipPlan): PlanTier {
  const name = plan.name.toLowerCase();

  if (name.includes("day") || plan.duration_days <= 7) {
    return "day";
  }

  if (name.includes("month") || plan.duration_days <= 45) {
    return "monthly";
  }

  return "annual";
}

export function formatPrice(price: number) {
  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(price)} VND`;
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getUserInitials(name?: string | null, email?: string | null) {
  if (name?.trim()) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return "AC";
}
