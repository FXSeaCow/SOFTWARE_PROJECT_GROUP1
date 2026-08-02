import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { MembershipBenefits } from "../features/membership/MembershipBenefits";
import { MembershipComparePlans } from "../features/membership/MembershipComparePlans";
import { MembershipFeaturedPlan } from "../features/membership/MembershipFeaturedPlan";
import { MembershipHeader } from "../features/membership/MembershipHeader";
import { MembershipHero } from "../features/membership/MembershipHero";
import { benefitCards, tierContent } from "../features/membership/constants";
import { getUserInitials, inferTier } from "../features/membership/utils";
import { useIsMobile } from "../hooks/useIsMobile";
import { AppShell } from "../layouts/AppShell";
import { getCurrentUser, logout } from "../services/authService";
import {
  activateMembership,
  CurrentMembership,
  getMembershipPlans,
  getMyMembership,
  getMyMembershipHistory,
  MembershipPlan,
  MembershipRecord,
  PendingMembershipCheckout,
  renewMembership,
} from "../services/membershipService";
import { getMyPayments, PaymentRecord, requestMembershipPayment } from "../services/paymentService";

function statusCardStyle(background: string, color: string): React.CSSProperties {
  return {
    maxWidth: 1380,
    margin: "18px auto 0",
    borderRadius: 24,
    padding: 20,
    background,
    color,
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function MembershipPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [currentMembership, setCurrentMembership] = useState<CurrentMembership | null>(null);
  const [membershipHistory, setMembershipHistory] = useState<MembershipRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState<PendingMembershipCheckout | null>(null);
  const [activationCodeInput, setActivationCodeInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRenewingPlanId, setIsRenewingPlanId] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isActivatingCode, setIsActivatingCode] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initials = getUserInitials(currentUser?.name, currentUser?.email);

  async function loadMembershipData() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [nextPlans, history, nextPayments] = await Promise.all([
        getMembershipPlans(),
        getMyMembershipHistory(),
        getMyPayments(),
      ]);

      setPlans(nextPlans);
      setMembershipHistory(history);
      setPayments(nextPayments);
      setSelectedPlanId((current) => current ?? nextPlans[0]?.id ?? null);

      try {
        const membership = await getMyMembership();
        setCurrentMembership(membership);

        const currentPlan = nextPlans.find((plan) => plan.id === membership.plan_id);
        if (currentPlan) {
          setSelectedPlanId(currentPlan.id);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("do not have an active membership")) {
          setCurrentMembership(null);
        } else {
          throw error;
        }
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load membership information.",
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

  const pendingPayment = payments.find((payment) => payment.status === "pending") ?? null;
  const activationMembership =
    membershipHistory.find(
      (membership) => membership.status === "suspended" && Boolean(membership.activation_code),
    ) ?? null;

  async function handleRenew(planId: string) {
    setIsRenewingPlanId(planId);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const checkout = await renewMembership(planId);
      setPendingCheckout(checkout);
      setActivationCodeInput("");
      setFeedbackMessage("QR payment created. Transfer the exact amount, then press I paid.");
      await loadMembershipData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to start membership checkout.",
      );
    } finally {
      setIsRenewingPlanId(null);
    }
  }

  async function handlePaidConfirmation() {
    if (!pendingCheckout) {
      return;
    }

    setIsSubmittingPayment(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      await requestMembershipPayment(pendingCheckout.id, pendingCheckout.transfer_note);
      setFeedbackMessage("Payment submitted. Admin will review your transfer shortly.");
      setPendingCheckout(null);
      await loadMembershipData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to submit payment confirmation.",
      );
    } finally {
      setIsSubmittingPayment(false);
    }
  }

  async function handleActivateMembership() {
    const code = activationCodeInput.trim();
    if (!code) {
      setErrorMessage("Please enter your activation code.");
      return;
    }

    setIsActivatingCode(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      await activateMembership(code);
      setActivationCodeInput("");
      setFeedbackMessage("Membership activated successfully.");
      await loadMembershipData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to activate membership.",
      );
    } finally {
      setIsActivatingCode(false);
    }
  }

  return (
    <AppShell activeItem="membership">
      <MembershipHeader
        initials={initials}
        isProfileMenuOpen={isProfileMenuOpen}
        hideActions
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
        onAdminClick={() => {
          setIsProfileMenuOpen(false);
          navigate("/admin");
        }}
        showAdminEntry={isAdmin}
        onLogoutClick={() => {
          logout();
          navigate("/login", { replace: true });
        }}
      />

      <MembershipHero />

      {errorMessage ? <div className="dashboard-card-enter" style={statusCardStyle("rgba(127,29,29,0.32)", "#fecaca")}>{errorMessage}</div> : null}
      {feedbackMessage ? <div className="dashboard-card-enter" style={statusCardStyle("rgba(6,95,70,0.32)", "#bbf7d0")}>{feedbackMessage}</div> : null}

      {pendingCheckout ? (
        <section className="interactive-card dashboard-card-enter" style={statusCardStyle("rgba(17,24,39,0.94)", "#f8fafc")}>
          <div
            style={{
              display: "grid",
              gap: 18,
              gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 280px) minmax(0, 1fr)",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: 18,
                padding: 16,
                display: "grid",
                placeItems: "center",
              }}
            >
              <img
                src={pendingCheckout.payment_qr_code}
                alt="Payment QR"
                style={{ width: "100%", maxWidth: 240, height: "auto" }}
              />
            </div>

            <div>
              <div style={{ color: "#ffb15f", fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Bank transfer
              </div>
              <h2 style={{ margin: "8px 0 12px", fontSize: 30 }}>Scan QR and transfer</h2>
              <div style={{ display: "grid", gap: 8, color: "#d1d5db", fontSize: 15 }}>
                <div>Plan: <strong style={{ color: "#ffffff" }}>{pendingCheckout.plan_name}</strong></div>
                <div>Amount: <strong style={{ color: "#ffffff" }}>{formatCurrency(pendingCheckout.price)}</strong></div>
                <div>Bank: <strong style={{ color: "#ffffff" }}>{pendingCheckout.bank_name}</strong></div>
                <div>Account: <strong style={{ color: "#ffffff" }}>{pendingCheckout.bank_account_number}</strong></div>
                <div>Holder: <strong style={{ color: "#ffffff" }}>{pendingCheckout.bank_account_name}</strong></div>
                <div>Transfer content: <strong style={{ color: "#fbbf24" }}>{pendingCheckout.transfer_note}</strong></div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => void handlePaidConfirmation()}
                  disabled={isSubmittingPayment}
                  style={{
                    border: "none",
                    borderRadius: 14,
                    padding: "14px 20px",
                    background: "#ff6a13",
                    color: "#050505",
                    fontWeight: 900,
                    cursor: isSubmittingPayment ? "not-allowed" : "pointer",
                  }}
                >
                  {isSubmittingPayment ? "Submitting..." : "I paid"}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingCheckout(null)}
                  style={{
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 14,
                    padding: "14px 20px",
                    background: "transparent",
                    color: "#f8fafc",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Hide QR
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {!pendingCheckout && pendingPayment ? (
        <section className="interactive-card dashboard-card-enter pending-badge" style={statusCardStyle("rgba(120,53,15,0.32)", "#fde68a")}>
          Payment for <strong>{pendingPayment.plan_name ?? "your membership"}</strong> is waiting for admin approval.
        </section>
      ) : null}

      {activationMembership ? (
        <section className="interactive-card dashboard-card-enter" style={statusCardStyle("rgba(30,41,59,0.92)", "#f8fafc")}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ color: "#93c5fd", fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Activation ready
            </div>
            <h2 style={{ margin: 0, fontSize: 28 }}>Your code is ready</h2>
            <div style={{ color: "#cbd5e1" }}>
              Admin approved your payment. Use this code to activate the <strong>{activationMembership.plan_name}</strong> membership.
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                width: "fit-content",
                borderRadius: 16,
                padding: "14px 18px",
                background: "rgba(255,255,255,0.06)",
                border: "1px dashed rgba(147,197,253,0.5)",
                fontSize: 24,
                fontWeight: 1000,
                letterSpacing: "0.1em",
              }}
            >
              {activationMembership.activation_code}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <input
                value={activationCodeInput}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  setActivationCodeInput(event.target.value.toUpperCase())
                }
                placeholder="Enter activation code"
                style={{
                  flex: "1 1 260px",
                  minHeight: 52,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#f8fafc",
                  padding: "0 16px",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              />
              <button
                type="button"
                onClick={() => void handleActivateMembership()}
                disabled={isActivatingCode}
                style={{
                  border: "none",
                  borderRadius: 14,
                  padding: "0 22px",
                  minHeight: 52,
                  background: "#22c55e",
                  color: "#03120a",
                  fontWeight: 900,
                  cursor: isActivatingCode ? "not-allowed" : "pointer",
                }}
              >
                {isActivatingCode ? "Activating..." : "Activate membership"}
              </button>
            </div>
          </div>
        </section>
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
    </AppShell>
  );
}
