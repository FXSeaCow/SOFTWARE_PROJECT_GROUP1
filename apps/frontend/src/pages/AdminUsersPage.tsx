import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Ban,
  BellRing,
  CalendarClock,
  ChevronDown,
  Crown,
  EllipsisVertical,
  Flame,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Trash2,
  Unlock,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { panelStyle, startButtonStyle } from "../components/main-menu/styles";
import { AdminPageLayout } from "../layouts/AdminPageLayout";
import { getCurrentUser } from "../services/authService";
import {
  AdminMembershipRecord,
  createAdminMembership,
  createAdminPlan,
  expireOverdueMemberships,
  getAdminMembershipPlans,
  listAdminMemberships,
  MembershipPlan,
  updateAdminPlan,
  updateMembershipStatus,
} from "../services/membershipService";
import {
  AdminUserRecord,
  AdminUserRole,
  deleteAdminUser,
  listAdminUsers,
  toggleAdminUserStatus,
  updateAdminUserRole,
} from "../services/adminUserService";
import { FitnessProgress, getAdminUserFitnessProgress } from "../services/fitnessRecordsService";
import { FitnessMetricsChart } from "../components/progress/FitnessMetricsChart";
import { AdminUserStreakResult, getAdminUserStreak, recalculateAdminUserStreak } from "../services/progressService";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function roleAccent(role: AdminUserRole) {
  return role === "admin"
    ? { background: "rgba(255,122,26,0.16)", color: "#ffb15f" }
    : { background: "rgba(37,99,235,0.18)", color: "#93c5fd" };
}

function membershipAccent(status: AdminUserRecord["membership_status"]) {
  switch (status) {
    case "active":
      return { background: "rgba(34,197,94,0.16)", color: "#86efac" };
    case "expired":
      return { background: "rgba(248,113,113,0.16)", color: "#fca5a5" };
    case "suspended":
      return { background: "rgba(250,204,21,0.16)", color: "#fde68a" };
    case "cancelled":
      return { background: "rgba(148,163,184,0.18)", color: "#cbd5e1" };
    default:
      return { background: "rgba(255,255,255,0.08)", color: "#d1d5db" };
  }
}

function statusAccent(status: AdminUserRecord["account_status"]) {
  return status === "active"
    ? { background: "rgba(34,197,94,0.16)", color: "#86efac" }
    : { background: "rgba(248,113,113,0.16)", color: "#fca5a5" };
}

function pillStyle(colors: { background: string; color: string }): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 26,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    background: colors.background,
    color: colors.color,
    whiteSpace: "nowrap",
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AdminUsersPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AdminUserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminUserRecord["account_status"]>("all");
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [currentMembershipPlanId, setCurrentMembershipPlanId] = useState("");
  const [selectedMembership, setSelectedMembership] = useState<AdminMembershipRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMembershipPlans, setIsLoadingMembershipPlans] = useState(true);
  const [isSavingMembership, setIsSavingMembership] = useState(false);
  const [isUpdatingMembershipStatus, setIsUpdatingMembershipStatus] = useState(false);
  const [isExpiringOverdue, setIsExpiringOverdue] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [allPlans, setAllPlans] = useState<MembershipPlan[]>([]);
  const [isLoadingAllPlans, setIsLoadingAllPlans] = useState(true);
  const [editingPlanId, setEditingPlanId] = useState<string | "new" | null>(null);
  const [planNameInput, setPlanNameInput] = useState("");
  const [planDescriptionInput, setPlanDescriptionInput] = useState("");
  const [planPriceInput, setPlanPriceInput] = useState("");
  const [planDurationInput, setPlanDurationInput] = useState("");
  const [planActiveInput, setPlanActiveInput] = useState(true);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [selectedUserProgress, setSelectedUserProgress] = useState<FitnessProgress | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);

  const [selectedUserStreak, setSelectedUserStreak] = useState<AdminUserStreakResult | null>(null);
  const [isLoadingStreak, setIsLoadingStreak] = useState(false);
  const [isRecalculatingStreak, setIsRecalculatingStreak] = useState(false);

  async function loadUsers(nextSearch = search) {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listAdminUsers({ search: nextSearch });
      setUsers(result.users);
      setTotalUsers(result.total);
      setSelectedUserId((current) => current ?? result.users[0]?.id ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load users");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers("");
  }, []);

  useEffect(() => {
    async function loadPlans() {
      setIsLoadingMembershipPlans(true);

      try {
        const plans = await getAdminMembershipPlans();
        setMembershipPlans(plans.filter((plan) => plan.is_active !== false));
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load membership plans");
      } finally {
        setIsLoadingMembershipPlans(false);
      }
    }

    void loadPlans();
  }, []);

  const stats = useMemo(() => {
    const total = totalUsers;
    const admins = users.filter((user) => user.role === "admin").length;
    const locked = users.filter((user) => user.account_status === "locked").length;
    const activeMemberships = users.filter((user) => user.membership_status === "active").length;
    return { total, admins, locked, activeMemberships };
  }, [totalUsers, users]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false;
      }
      if (statusFilter !== "all" && user.account_status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [roleFilter, statusFilter, users]);

  const selectedUser =
    filteredUsers.find((user) => user.id === selectedUserId) ??
    users.find((user) => user.id === selectedUserId) ??
    filteredUsers[0] ??
    users[0] ??
    null;

  useEffect(() => {
    if (selectedUser && selectedUser.id !== selectedUserId) {
      setSelectedUserId(selectedUser.id);
    }
  }, [selectedUser, selectedUserId]);

  useEffect(() => {
    async function loadSelectedUserMembership() {
      if (!selectedUser) {
        setCurrentMembershipPlanId("");
        setSelectedPlanId("");
        setSelectedMembership(null);
        return;
      }

      try {
        const memberships = await listAdminMemberships({
          userId: selectedUser.id,
          limit: 1,
        });

        const latest = memberships[0] ?? null;
        setSelectedMembership(latest);
        setCurrentMembershipPlanId(latest?.plan_id ?? "");
        setSelectedPlanId(latest?.plan_id ?? "");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Unable to load membership");
      }
    }

    void loadSelectedUserMembership();
  }, [selectedUser?.id]);

  useEffect(() => {
    async function loadSelectedUserProgress() {
      if (!selectedUser) {
        setSelectedUserProgress(null);
        return;
      }

      setIsLoadingProgress(true);

      try {
        const progress = await getAdminUserFitnessProgress(selectedUser.id, { limit: 15 });
        setSelectedUserProgress(progress);
      } catch {
        setSelectedUserProgress(null);
      } finally {
        setIsLoadingProgress(false);
      }
    }

    void loadSelectedUserProgress();
  }, [selectedUser?.id]);

  async function loadSelectedUserStreak() {
    if (!selectedUser) {
      setSelectedUserStreak(null);
      return;
    }

    setIsLoadingStreak(true);

    try {
      const streak = await getAdminUserStreak(selectedUser.id);
      setSelectedUserStreak(streak);
    } catch {
      setSelectedUserStreak(null);
    } finally {
      setIsLoadingStreak(false);
    }
  }

  useEffect(() => {
    void loadSelectedUserStreak();
  }, [selectedUser?.id]);

  async function handleRecalculateStreak() {
    if (!selectedUser) {
      return;
    }

    setIsRecalculatingStreak(true);
    setFeedback(null);
    setError(null);

    try {
      const streak = await recalculateAdminUserStreak(selectedUser.id);
      setSelectedUserStreak(streak);
      setFeedback("Streak recalculated successfully");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to recalculate streak");
    } finally {
      setIsRecalculatingStreak(false);
    }
  }

  async function loadAllPlans() {
    setIsLoadingAllPlans(true);

    try {
      setAllPlans(await getAdminMembershipPlans());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load plans");
    } finally {
      setIsLoadingAllPlans(false);
    }
  }

  useEffect(() => {
    void loadAllPlans();
  }, []);

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    await loadUsers(search);
  }

  async function handleRoleChange(userId: string, role: AdminUserRole) {
    setFeedback(null);
    setError(null);

    try {
      await updateAdminUserRole(userId, role);
      await loadUsers(search);
      setSelectedUserId(userId);
      setFeedback("User role updated");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update role");
    }
  }

  async function handleToggleStatus(userId: string) {
    setFeedback(null);
    setError(null);

    try {
      const currentUserRecord = users.find((user) => user.id === userId);
      if (!currentUserRecord) {
        throw new Error("User not found");
      }

      const updated = await toggleAdminUserStatus(currentUserRecord);
      await loadUsers(search);
      setSelectedUserId(userId);
      setFeedback(
        updated.account_status === "locked"
          ? "Account locked successfully"
          : "Account unlocked successfully",
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update account status");
    }
  }

  async function handleDelete(userId: string) {
    setFeedback(null);
    setError(null);

    try {
      await deleteAdminUser(userId);
      await loadUsers(search);
      setFeedback("User deleted successfully");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete user");
    }
  }

  async function handleSaveMembership() {
    if (!selectedUser || !selectedPlanId || selectedPlanId === currentMembershipPlanId) {
      return;
    }

    setIsSavingMembership(true);
    setFeedback(null);
    setError(null);

    try {
      await createAdminMembership(selectedUser.id, selectedPlanId);
      await loadUsers(search);
      setCurrentMembershipPlanId(selectedPlanId);
      setFeedback("Membership updated successfully");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update membership");
    } finally {
      setIsSavingMembership(false);
    }
  }

  async function handleMembershipStatusChange(status: "active" | "suspended" | "cancelled") {
    if (!selectedMembership) {
      return;
    }

    setIsUpdatingMembershipStatus(true);
    setFeedback(null);
    setError(null);

    try {
      const updated = await updateMembershipStatus(selectedMembership.id, status);
      setSelectedMembership({ ...selectedMembership, status: updated.status });
      await loadUsers(search);
      setFeedback(`Membership ${status} successfully`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update membership status");
    } finally {
      setIsUpdatingMembershipStatus(false);
    }
  }

  async function handleExpireOverdue() {
    setIsExpiringOverdue(true);
    setFeedback(null);
    setError(null);

    try {
      const result = await expireOverdueMemberships();
      await loadUsers(search);
      setFeedback(`${result.expired_count} membership(s) expired`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to run expiry job");
    } finally {
      setIsExpiringOverdue(false);
    }
  }

  function startCreatePlan() {
    setEditingPlanId("new");
    setPlanNameInput("");
    setPlanDescriptionInput("");
    setPlanPriceInput("");
    setPlanDurationInput("");
    setPlanActiveInput(true);
    setPlanError(null);
  }

  function startEditPlan(plan: MembershipPlan) {
    setEditingPlanId(plan.id);
    setPlanNameInput(plan.name);
    setPlanDescriptionInput(plan.description ?? "");
    setPlanPriceInput(String(plan.price));
    setPlanDurationInput(String(plan.duration_days));
    setPlanActiveInput(plan.is_active !== false);
    setPlanError(null);
  }

  function cancelPlanEdit() {
    setEditingPlanId(null);
    setPlanError(null);
  }

  async function handlePlanSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPlanError(null);

    const price = Number(planPriceInput);
    const durationDays = Number(planDurationInput);

    if (!planNameInput.trim()) {
      setPlanError("Plan name is required.");
      return;
    }

    if (!price || price <= 0) {
      setPlanError("Enter a valid price.");
      return;
    }

    if (!durationDays || durationDays <= 0) {
      setPlanError("Enter a valid duration in days.");
      return;
    }

    setIsSavingPlan(true);

    try {
      if (editingPlanId === "new") {
        await createAdminPlan({
          name: planNameInput.trim(),
          description: planDescriptionInput.trim() || undefined,
          price,
          duration_days: durationDays,
        });
        setFeedback("Plan created successfully");
      } else if (editingPlanId) {
        await updateAdminPlan(editingPlanId, {
          name: planNameInput.trim(),
          description: planDescriptionInput.trim() || undefined,
          price,
          duration_days: durationDays,
          is_active: planActiveInput,
        });
        setFeedback("Plan updated successfully");
      }

      setEditingPlanId(null);
      await loadAllPlans();

      const activePlans = await getAdminMembershipPlans();
      setMembershipPlans(activePlans.filter((plan) => plan.is_active !== false));
    } catch (nextError) {
      setPlanError(nextError instanceof Error ? nextError.message : "Unable to save plan");
    } finally {
      setIsSavingPlan(false);
    }
  }

  return (
    <AdminPageLayout activeItem="users">
      <section
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 6 }}>Members</div>
          <div style={{ color: "#9ca8b7", fontSize: 14 }}>
            Manage accounts, roles, access status, and membership plans.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button
            type="button"
            onClick={() => void handleExpireOverdue()}
            isLoading={isExpiringOverdue}
            loadingText="Running..."
            style={{
              width: "auto",
              height: 46,
              background: "rgba(255,255,255,0.02)",
              color: "#f5f5f5",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            leftIcon={<CalendarClock size={16} />}
          >
            Run expire overdue
          </Button>
          <Button
            type="button"
            onClick={() => navigate("/admin/announcements")}
            style={{
              width: "auto",
              height: 46,
              background: "#ff7a1a",
              color: "#111111",
            }}
            leftIcon={<BellRing size={16} />}
          >
            Create announcement
          </Button>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {[
          { label: "Total members", value: stats.total, icon: <Users size={18} />, iconBg: "rgba(255,122,26,0.12)", iconColor: "#ff9a3d" },
          { label: "Administrators", value: stats.admins, icon: <Shield size={18} />, iconBg: "rgba(255,122,26,0.12)", iconColor: "#ff9a3d" },
          { label: "Locked", value: stats.locked, icon: <Lock size={18} />, iconBg: "rgba(239,68,68,0.12)", iconColor: "#f87171" },
          { label: "Active plans", value: stats.activeMemberships, icon: <Crown size={18} />, iconBg: "rgba(245,158,11,0.12)", iconColor: "#f59e0b" },
        ].map((item) => (
          <div key={item.label} className="interactive-card dashboard-card-enter" style={{ ...panelStyle, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  display: "grid",
                  placeItems: "center",
                  background: item.iconBg,
                  color: item.iconColor,
                }}
              >
                {item.icon}
              </div>
              <div>
                <div style={{ color: "#d4d4d8", fontSize: 14, marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{item.value}</div>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.7fr) minmax(290px, 0.85fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div className="dashboard-card-enter" style={panelStyle}>
          <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 18 }}>Member management</div>

          <form
            onSubmit={handleSearchSubmit}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 86px 96px 140px",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                minHeight: 46,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 14px",
              }}
            >
              <Search size={16} color="#9ca8b7" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or email"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "#f5f5f5",
                  fontSize: 14,
                }}
              />
            </div>

            <label style={{ position: "relative" }}>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as "all" | AdminUserRole)}
                style={{
                  width: "100%",
                  minHeight: 46,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                  color: "#f5f5f5",
                  padding: "0 34px 0 14px",
                  appearance: "none",
                  fontSize: 14,
                }}
              >
                <option value="all">Role</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
              </select>
              <ChevronDown
                size={16}
                style={{ position: "absolute", right: 12, top: 15, pointerEvents: "none", color: "#9ca8b7" }}
              />
            </label>

            <label style={{ position: "relative" }}>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | AdminUserRecord["account_status"])
                }
                style={{
                  width: "100%",
                  minHeight: 46,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                  color: "#f5f5f5",
                  padding: "0 34px 0 14px",
                  appearance: "none",
                  fontSize: 14,
                }}
              >
                <option value="all">Status</option>
                <option value="active">Active</option>
                <option value="locked">Locked</option>
              </select>
              <ChevronDown
                size={16}
                style={{ position: "absolute", right: 12, top: 15, pointerEvents: "none", color: "#9ca8b7" }}
              />
            </label>

            <Button type="submit" style={{ background: "#ff7a1a", color: "#111111", minHeight: 46 }}>
              Search
            </Button>
          </form>

          {error ? (
            <div
              style={{
                marginBottom: 14,
                borderRadius: 14,
                padding: "12px 14px",
                background: "rgba(127,29,29,0.32)",
                color: "#fecaca",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          ) : null}

          {feedback ? (
            <div
              style={{
                marginBottom: 14,
                borderRadius: 14,
                padding: "12px 14px",
                background: "rgba(22,101,52,0.28)",
                color: "#bbf7d0",
                fontSize: 14,
              }}
            >
              {feedback}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.5fr 0.8fr 0.9fr 1.1fr 1fr 0.9fr 28px",
              gap: 12,
              padding: "14px 12px",
              color: "#9ca8b7",
              fontSize: 12,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <span>Member</span>
            <span>Role</span>
            <span>Status</span>
            <span>Plan</span>
            <span>Updated</span>
            <span>Action</span>
            <span />
          </div>

          <div>
            {isLoading ? (
              <div style={{ display: "grid" }}>
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`user-skeleton-${index}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.5fr 0.8fr 0.9fr 1.1fr 1fr 0.9fr 28px",
                      gap: 12,
                      alignItems: "center",
                      padding: "14px 12px",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Skeleton height={36} width={36} radius={999} />
                      <div style={{ display: "grid", gap: 8, flex: 1 }}>
                        <Skeleton height={16} width="44%" radius={8} />
                        <Skeleton height={14} width="64%" radius={8} />
                      </div>
                    </div>
                    <Skeleton height={26} width="74%" radius={999} />
                    <Skeleton height={26} width="70%" radius={999} />
                    <Skeleton height={26} width="78%" radius={999} />
                    <Skeleton height={14} width="88%" radius={8} />
                    <Skeleton height={34} width="82%" radius={10} />
                    <Skeleton height={16} width={16} radius={8} />
                  </div>
                ))}
              </div>
            ) : null}

            {!isLoading && filteredUsers.map((user) => {
              const isSelected = selectedUser?.id === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUserId(user.id)}
                  style={{
                    width: "100%",
                    border: "none",
                    background: isSelected ? "rgba(255,122,26,0.05)" : "transparent",
                    borderLeft: isSelected ? "2px solid #ff7a1a" : "2px solid transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    padding: "14px 12px",
                    color: "#f5f5f5",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.5fr 0.8fr 0.9fr 1.1fr 1fr 0.9fr 28px",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          background: isSelected ? "#ff7a1a" : "rgba(255,255,255,0.65)",
                          color: isSelected ? "#111111" : "#111111",
                          fontWeight: 900,
                          flexShrink: 0,
                        }}
                      >
                        {initials(user.full_name)}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{user.full_name}</div>
                        <div style={{ color: "#9ca8b7", fontSize: 13, marginTop: 4 }}>{user.email}</div>
                      </div>
                    </div>
                    <span style={pillStyle(roleAccent(user.role))}>{user.role}</span>
                    <span style={pillStyle(statusAccent(user.account_status))}>{user.account_status}</span>
                    <span style={pillStyle(membershipAccent(user.membership_status))}>
                      {user.membership_status === "none" ? "No plan" : `Plan ${user.membership_status}`}
                    </span>
                    <span style={{ color: "#b4bac4", fontSize: 13 }}>
                      {formatDate(user.updated_at || user.created_at)}
                    </span>
                    <span
                      style={{
                        minHeight: 34,
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.08)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Manage
                    </span>
                    <EllipsisVertical size={16} color="#9ca8b7" />
                  </div>
                </button>
              );
            })}

            {!isLoading && filteredUsers.length === 0 ? (
              <div
                style={{
                  borderRadius: 18,
                  border: "1px dashed rgba(255,255,255,0.12)",
                  padding: 28,
                  textAlign: "center",
                  color: "#9ca8b7",
                  marginTop: 14,
                }}
              >
                No matching members found.
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingTop: 18,
              color: "#9ca8b7",
              fontSize: 13,
            }}
          >
            <span>
              Showing {filteredUsers.length} / {filteredUsers.length} members
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                  color: "#9ca8b7",
                }}
              >
                {"<"}
              </button>
              <button
                type="button"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid rgba(255,122,26,0.24)",
                  background: "rgba(255,122,26,0.18)",
                  color: "#ffb15f",
                  fontWeight: 800,
                }}
              >
                1
              </button>
              <button
                type="button"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.02)",
                  color: "#9ca8b7",
                }}
              >
                {">"}
              </button>
            </div>
          </div>
        </div>

        <aside className="dashboard-card-enter" style={panelStyle}>
          {selectedUser ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: "#ff7a1a",
                    color: "#111111",
                    fontWeight: 900,
                  }}
                >
                  {initials(selectedUser.full_name)}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 22 }}>{selectedUser.full_name}</div>
                  <div style={{ color: "#a1a1aa", fontSize: 14 }}>{selectedUser.email}</div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <DetailField label="Name">
                  <StaticValue value={selectedUser.full_name} />
                </DetailField>
                <DetailField label="Email">
                  <StaticValue value={selectedUser.email} />
                </DetailField>
                <DetailField label="Role">
                  <SelectValue
                    value={selectedUser.role}
                    onChange={(event) =>
                      void handleRoleChange(selectedUser.id, event.target.value as AdminUserRole)
                    }
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </SelectValue>
                </DetailField>
                <DetailField label="Membership">
                  <SelectValue
                    value={selectedPlanId}
                    onChange={(event) => setSelectedPlanId(event.target.value)}
                  >
                    <option value="">
                      {isLoadingMembershipPlans ? "Loading plans..." : "Select membership plan"}
                    </option>
                    {membershipPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </SelectValue>
                </DetailField>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 1fr",
                  rowGap: 14,
                  columnGap: 12,
                  color: "#a1a1aa",
                  fontSize: 14,
                  marginTop: 22,
                  paddingTop: 18,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                    <span>Created</span>
                <span>{formatDate(selectedUser.created_at)}</span>
                    <span>Updated</span>
                <span>{formatDate(selectedUser.updated_at || selectedUser.created_at)}</span>
              </div>

              {selectedMembership ? (
                <div
                  style={{
                    marginTop: 22,
                    paddingTop: 18,
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div style={{ color: "#a1a1aa", fontSize: 14, marginBottom: 10 }}>
                    Membership status: <strong style={{ color: "#f5f5f5" }}>{selectedMembership.status}</strong>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {selectedMembership.status !== "active" ? (
                      <button
                        type="button"
                        onClick={() => void handleMembershipStatusChange("active")}
                        disabled={isUpdatingMembershipStatus}
                        style={smallActionButtonStyle("rgba(34,197,94,0.14)", "#86efac", "1px solid rgba(34,197,94,0.28)")}
                      >
                        Reactivate
                      </button>
                    ) : null}
                    {selectedMembership.status !== "suspended" ? (
                      <button
                        type="button"
                        onClick={() => void handleMembershipStatusChange("suspended")}
                        disabled={isUpdatingMembershipStatus}
                        style={smallActionButtonStyle("rgba(250,204,21,0.14)", "#fde68a", "1px solid rgba(250,204,21,0.28)")}
                      >
                        Suspend
                      </button>
                    ) : null}
                    {selectedMembership.status !== "cancelled" ? (
                      <button
                        type="button"
                        onClick={() => void handleMembershipStatusChange("cancelled")}
                        disabled={isUpdatingMembershipStatus}
                        style={smallActionButtonStyle("rgba(239,68,68,0.14)", "#fca5a5", "1px solid rgba(239,68,68,0.28)")}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div
                style={{
                  marginTop: 22,
                  paddingTop: 18,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#a1a1aa", fontSize: 14, marginBottom: 12 }}>
                  <Activity size={16} />
                  <span>Fitness progress</span>
                </div>

                {isLoadingProgress ? (
                  <Skeleton height={60} width="100%" radius={12} />
                ) : selectedUserProgress && selectedUserProgress.record_count > 0 ? (
                  <>
                    <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>
                          {selectedUserProgress.latest_record?.weight_kg ?? "—"} kg
                        </div>
                        <div style={{ color: "#8d98a7", fontSize: 12 }}>Weight</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>
                          {selectedUserProgress.latest_record?.bmi?.toFixed(1) ?? "—"}
                        </div>
                        <div style={{ color: "#8d98a7", fontSize: 12 }}>BMI</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900 }}>{selectedUserProgress.record_count}</div>
                        <div style={{ color: "#8d98a7", fontSize: 12 }}>Records</div>
                      </div>
                    </div>
                    <FitnessMetricsChart
                      points={selectedUserProgress.trend
                        .filter((point) => point.weight_kg !== null)
                        .map((point) => ({
                          label: new Date(`${point.recorded_date}T00:00:00`).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          }),
                          value: point.weight_kg as number,
                        }))}
                      unit="kg"
                    />
                  </>
                ) : (
                  <div style={{ color: "#9ca8b7", fontSize: 13 }}>No fitness records logged yet.</div>
                )}
              </div>

              <div
                style={{
                  marginTop: 22,
                  paddingTop: 18,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#a1a1aa", fontSize: 14 }}>
                    <Flame size={16} />
                    <span>Workout streak</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRecalculateStreak()}
                    disabled={isRecalculatingStreak || !selectedUserStreak}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.02)",
                      color: "#d3dae5",
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "6px 10px",
                      cursor: isRecalculatingStreak ? "not-allowed" : "pointer",
                      opacity: isRecalculatingStreak ? 0.6 : 1,
                    }}
                  >
                    <RotateCcw size={12} />
                    {isRecalculatingStreak ? "Recalculating..." : "Recalculate"}
                  </button>
                </div>

                {isLoadingStreak ? (
                  <Skeleton height={40} width="100%" radius={12} />
                ) : selectedUserStreak ? (
                  <div style={{ display: "flex", gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>
                        {selectedUserStreak.streak.current_streak}d
                      </div>
                      <div style={{ color: "#8d98a7", fontSize: 12 }}>Current</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>
                        {selectedUserStreak.streak.longest_streak}d
                      </div>
                      <div style={{ color: "#8d98a7", fontSize: 12 }}>Longest</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900 }}>
                        {selectedUserStreak.streak.total_checkins}
                      </div>
                      <div style={{ color: "#8d98a7", fontSize: 12 }}>Check-ins</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "#9ca8b7", fontSize: 13 }}>No streak data yet.</div>
                )}
              </div>

              <div style={{ display: "grid", gap: 12, marginTop: 26 }}>
                <Button
                  type="button"
                  onClick={() => void handleSaveMembership()}
                  isLoading={isSavingMembership}
                  loadingText="Saving..."
                  disabled={!selectedPlanId || selectedPlanId === currentMembershipPlanId}
                  style={{ background: "#ff7a1a", color: "#111111", minHeight: 46 }}
                >
                  Save changes
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleToggleStatus(selectedUser.id)}
                  style={{
                    minHeight: 46,
                    background: selectedUser.account_status === "active" ? "#4a1919" : "#13301f",
                    color: selectedUser.account_status === "active" ? "#fecaca" : "#bbf7d0",
                  }}
                  leftIcon={
                    selectedUser.account_status === "active" ? <Ban size={16} /> : <Unlock size={16} />
                  }
                >
                  {selectedUser.account_status === "active" ? "Lock account" : "Unlock account"}
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleDelete(selectedUser.id)}
                  disabled={currentUser?.id === selectedUser.id}
                  style={{
                    minHeight: 46,
                    background: "rgba(255,255,255,0.02)",
                    color: "#f5f5f5",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  leftIcon={<Trash2 size={16} />}
                >
                  Delete member
                </Button>
              </div>
            </>
          ) : (
            <div style={{ color: "#9ca8b7" }}>No member selected.</div>
          )}
        </aside>
      </section>

      <section className="dashboard-card-enter" style={{ ...panelStyle, marginTop: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 900 }}>Membership plans</div>
          <button
            type="button"
            onClick={startCreatePlan}
            style={{ ...startButtonStyle, minHeight: 40 }}
          >
            <Plus size={16} />
            New plan
          </button>
        </div>

        {editingPlanId ? (
          <form
            onSubmit={handlePlanSubmit}
            style={{
              padding: 16,
              borderRadius: 14,
              background: "rgba(255,122,26,0.05)",
              border: "1px solid rgba(255,122,26,0.18)",
              marginBottom: 18,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <label>
                <span style={planLabelStyle}>Name</span>
                <input
                  value={planNameInput}
                  onChange={(event) => setPlanNameInput(event.target.value)}
                  style={planInputStyle}
                  required
                />
              </label>
              <label>
                <span style={planLabelStyle}>Price (VND)</span>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  value={planPriceInput}
                  onChange={(event) => setPlanPriceInput(event.target.value)}
                  style={planInputStyle}
                  required
                />
              </label>
              <label>
                <span style={planLabelStyle}>Duration (days)</span>
                <input
                  type="number"
                  min="1"
                  value={planDurationInput}
                  onChange={(event) => setPlanDurationInput(event.target.value)}
                  style={planInputStyle}
                  required
                />
              </label>
              {editingPlanId !== "new" ? (
                <label style={{ display: "flex", alignItems: "flex-end", gap: 8, paddingBottom: 12 }}>
                  <input
                    type="checkbox"
                    checked={planActiveInput}
                    onChange={(event) => setPlanActiveInput(event.target.checked)}
                  />
                  <span style={{ color: "#d3dae5", fontSize: 14 }}>Active</span>
                </label>
              ) : null}
            </div>

            <label style={{ display: "block", marginBottom: 12 }}>
              <span style={planLabelStyle}>Description</span>
              <input
                value={planDescriptionInput}
                onChange={(event) => setPlanDescriptionInput(event.target.value)}
                style={planInputStyle}
              />
            </label>

            {planError ? (
              <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 12 }}>{planError}</div>
            ) : null}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="submit"
                disabled={isSavingPlan}
                style={{ ...startButtonStyle, minHeight: 38, opacity: isSavingPlan ? 0.6 : 1 }}
              >
                {isSavingPlan ? "Saving..." : "Save plan"}
              </button>
              <button
                type="button"
                onClick={cancelPlanEdit}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 999,
                  background: "transparent",
                  color: "#d3dae5",
                  minHeight: 38,
                  padding: "0 18px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {isLoadingAllPlans ? (
          <div style={{ display: "grid", gap: 10 }}>
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} height={56} width="100%" radius={12} />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {allPlans.map((plan) => (
              <div
                key={plan.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 16px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{plan.name}</div>
                  {plan.description ? (
                    <div style={{ color: "#8d98a7", fontSize: 12, marginTop: 4 }}>{plan.description}</div>
                  ) : null}
                </div>
                <div style={{ color: "#d3dae5", fontSize: 14, fontWeight: 700 }}>
                  {new Intl.NumberFormat("en-US").format(plan.price)} VND
                </div>
                <div style={{ color: "#d3dae5", fontSize: 14 }}>{plan.duration_days} days</div>
                <span
                  style={pillStyle(
                    plan.is_active === false
                      ? { background: "rgba(148,163,184,0.18)", color: "#cbd5e1" }
                      : { background: "rgba(34,197,94,0.16)", color: "#86efac" },
                  )}
                >
                  {plan.is_active === false ? "Inactive" : "Active"}
                </span>
                <button
                  type="button"
                  onClick={() => startEditPlan(plan)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#8d98a7",
                    cursor: "pointer",
                    padding: 6,
                  }}
                  aria-label="Edit plan"
                >
                  <Pencil size={16} />
                </button>
              </div>
            ))}

            {allPlans.length === 0 ? (
              <div style={{ color: "#9ca8b7", fontSize: 14 }}>No membership plans yet.</div>
            ) : null}
          </div>
        )}
      </section>
    </AdminPageLayout>
  );
}

function smallActionButtonStyle(background: string, color: string, border: string): React.CSSProperties {
  return {
    borderRadius: 8,
    border,
    background,
    color,
    fontWeight: 800,
    fontSize: 13,
    padding: "8px 14px",
    cursor: "pointer",
  };
}

const planLabelStyle: React.CSSProperties = {
  color: "#9ca8b7",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
  display: "block",
};

const planInputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 42,
  borderRadius: 12,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#f5f5f5",
  padding: "0 12px",
  fontSize: 14,
  boxSizing: "border-box",
};

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "64px minmax(0, 1fr)",
        gap: 12,
        alignItems: "center",
      }}
    >
      <span style={{ color: "#a1a1aa", fontSize: 14 }}>{label}</span>
      {children}
    </div>
  );
}

function StaticValue({ value }: { value: string }) {
  return (
    <div
      style={{
        minHeight: 40,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
        padding: "0 12px",
        display: "flex",
        alignItems: "center",
        fontSize: 14,
      }}
    >
      {value}
    </div>
  );
}

function SelectValue({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  children: React.ReactNode;
}) {
  return (
    <label style={{ position: "relative", display: "block" }}>
      <select
        value={value}
        onChange={onChange}
        style={{
          width: "100%",
          minHeight: 40,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
          color: "#f5f5f5",
          padding: "0 36px 0 12px",
          appearance: "none",
          fontSize: 14,
          colorScheme: "dark",
        }}
      >
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child)) {
            return child;
          }

          return React.cloneElement(child as React.ReactElement<{ style?: React.CSSProperties }>, {
            style: {
              color: "#111111",
              backgroundColor: "#ffffff",
              ...child.props.style,
            },
          });
        })}
      </select>
      <ChevronDown
        size={16}
        style={{ position: "absolute", right: 12, top: 12, color: "#9ca8b7", pointerEvents: "none" }}
      />
    </label>
  );
}
