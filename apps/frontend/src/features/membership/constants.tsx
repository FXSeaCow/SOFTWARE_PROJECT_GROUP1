import React from "react";
import { Bolt, Clock3, Crown, Shield, Star } from "lucide-react";

import { MembershipBenefitCard, MembershipTierContent, PlanTier } from "./types";

export const benefitCards: MembershipBenefitCard[] = [
  {
    icon: <Shield size={18} />,
    title: "NO LOCK-IN CONTRACTS",
    subtitle: "Cancel anytime",
  },
  {
    icon: <Star size={18} />,
    title: "FREE FIRST WEEK",
    subtitle: "No commitment",
  },
  {
    icon: <Clock3 size={18} />,
    title: "24/7 ACCESS",
    subtitle: "Open every day",
  },
];

export const tierContent: Record<PlanTier, MembershipTierContent> = {
  day: {
    icon: <Bolt size={24} />,
    fallbackPrice: 9.99,
    unit: "/ day",
    title: "Day Pass",
    subtitle: "Try it today",
    features: [
      "Full gym floor access",
      "Locker room and showers",
      "Basic equipment use",
      "Group class (1 session)",
      "Guest WiFi",
    ],
  },
  monthly: {
    icon: <Crown size={24} />,
    fallbackPrice: 49.99,
    unit: "/ month",
    badge: "Popular",
    title: "Monthly",
    subtitle: "Train consistently",
    features: [
      "Unlimited gym access",
      "Unlimited group classes",
      "Member workout tracking",
      "Basic membership support",
      "Monthly renewal",
    ],
  },
  annual: {
    icon: <Star size={24} />,
    fallbackPrice: 399.99,
    unit: "/ year",
    badge: "Best deal",
    title: "Annual",
    subtitle: "Best long term value",
    features: [
      "24/7 gym access",
      "Premium class access",
      "Priority member support",
      "Personal progress dashboard",
      "Best yearly price",
    ],
  },
};

export const membershipTiers: PlanTier[] = ["day", "monthly", "annual"];
