import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { MainMenuBottomNav } from "../components/main-menu/MainMenuBottomNav";
import { MembershipBenefits } from "../features/membership/MembershipBenefits";
import { MembershipComparePlans } from "../features/membership/MembershipComparePlans";
import { MembershipFeaturedPlan } from "../features/membership/MembershipFeaturedPlan";
import { MembershipHeader } from "../features/membership/MembershipHeader";
import { MembershipHero } from "../features/membership/MembershipHero";
import { benefitCards, tierContent } from "../features/membership/constants";
import { getUserInitials, inferTier } from "../features/membership/utils";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { getCurrentUser, logout } from "../services/authService";
import {
  CurrentMembership,
  MembershipPlan,
  getMembershipPlans,
  getMyMembership,
  renewMembership,
} from "../services/membershipService";

export function MembershipPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [currentMembership, setCurrentMembership] = useState<CurrentMembership | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRenewingPlanId, setIsRenewingPlanId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initials = getUserInitials(currentUser?.name, currentUser?.email);

  async function loadMembershipData() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextPlans = await getMembershipPlans();
      setPlans(nextPlans);
      setSelectedPlanId((current) => current ?? nextPlans[0]?.id ?? null);

      try {
        const membership = await getMyMembership();
        setCurrentMembership(membership);

        const currentPlan = nextPlans.find((plan) => plan.id === membership.plan_id);
        if (currentPlan) {
          setSelectedPlanId(currentPlan.id);
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes("do not have an active membership")
        ) {
          setCurrentMembership(null);
        } else {
          throw error;
        }
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load membership information.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMembershipData();
  }, []);

  const activePlan = useMemo(() => {
    if (plans.length === 0) {
      return null;
    }

    return plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];
  }, [plans, selectedPlanId]);

  const activeTierContent = tierContent[activePlan ? inferTier(activePlan) : "day"];

  async function handleRenew(planId: string) {
    setIsRenewingPlanId(planId);
    setErrorMessage(null);

    try {
      await renewMembership(planId);
      await loadMembershipData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to renew membership. Please try again.",
      );
    } finally {
      setIsRenewingPlanId(null);
    }
  }

  return (
    <DashboardLayout bottomNav={<MainMenuBottomNav profileHref="/" activeItem="none" />}>
      <MembershipHeader
        initials={initials}
        isProfileMenuOpen={isProfileMenuOpen}
        onProfileClick={() => {
          setIsProfileMenuOpen((current) => !current);
        }}
        onMembershipClick={() => {
          setIsProfileMenuOpen(false);
          navigate("/membership");
        }}
        onAccountClick={() => {
          setIsProfileMenuOpen(false);
          navigate("/account");
        }}
        onLogoutClick={() => {
          logout();
          navigate("/login", { replace: true });
        }}
      />

      <MembershipHero />

      {errorMessage ? (
        <div
          style={{
            maxWidth: 1380,
            margin: "18px auto 0",
            borderRadius: 16,
            padding: "14px 16px",
            background: "rgba(127,29,29,0.32)",
            color: "#fecaca",
            fontSize: 14,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      <MembershipBenefits benefits={benefitCards} />

      <MembershipComparePlans
        featuredPlan={
          <MembershipFeaturedPlan
            isLoading={isLoading}
            currentUser={currentUser}
            currentMembership={currentMembership}
            activePlan={activePlan}
            activeTierContent={activeTierContent}
            isRenewing={isRenewingPlanId === activePlan?.id}
            onPrimaryAction={() => {
              if (!activePlan) {
                return;
              }

              if (!currentUser) {
                navigate("/login");
                return;
              }

              void handleRenew(activePlan.id);
            }}
          />
        }
        plans={plans}
        selectedPlanId={activePlan?.id ?? null}
        tierContent={tierContent}
        onSelectPlan={setSelectedPlanId}
      />
    </DashboardLayout>
  );
}
