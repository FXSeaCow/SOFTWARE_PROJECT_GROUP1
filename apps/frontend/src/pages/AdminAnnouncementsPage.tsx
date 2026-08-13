import React, { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Megaphone,
  Send,
  ShieldAlert,
  Users,
} from "lucide-react";

import { Button } from "../components/Button";
import { panelStyle, searchBarStyle } from "../components/main-menu/styles";
import { useIsMobile } from "../hooks/useIsMobile";
import { AdminPageLayout } from "../layouts/AdminPageLayout";
import {
  AdminAnnouncementRecord,
  AnnouncementTarget,
  AnnouncementType,
  createAdminAnnouncement,
  listAdminAnnouncements,
} from "../services/announcementService";
import { AdminUserRecord, listAdminUsers } from "../services/adminUserService";

type FormState = {
  title: string;
  body: string;
  type: AnnouncementType;
  send_to: AnnouncementTarget;
  user_ids: string[];
};

const initialForm: FormState = {
  title: "",
  body: "",
  type: "announcement",
  send_to: "all",
  user_ids: [],
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function notificationAccent(type: AnnouncementType): React.CSSProperties {
  if (type === "system") {
    return { background: "rgba(239,68,68,0.16)", color: "#fca5a5" };
  }

  if (type === "membership") {
    return { background: "rgba(59,130,246,0.18)", color: "#93c5fd" };
  }

  if (type === "schedule") {
    return { background: "rgba(245,158,11,0.16)", color: "#fde68a" };
  }

  return { background: "rgba(255,122,26,0.16)", color: "#ffb15f" };
}

function darkOptionStyle(): React.CSSProperties {
  return {
    color: "#f5f5f5",
    backgroundColor: "#161616",
  };
}

export function AdminAnnouncementsPage() {
  const isMobile = useIsMobile();
  const [form, setForm] = useState<FormState>(initialForm);
  const [announcements, setAnnouncements] = useState<AdminAnnouncementRecord[]>([]);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadAnnouncements() {
    setIsLoadingHistory(true);

    try {
      const nextAnnouncements = await listAdminAnnouncements();
      setAnnouncements(nextAnnouncements);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load announcement history.",
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function loadUsers() {
    setIsLoadingUsers(true);

    try {
      const result = await listAdminUsers();
      setUsers(result.users.filter((user) => user.account_status === "active"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load users.");
    } finally {
      setIsLoadingUsers(false);
    }
  }

  useEffect(() => {
    void loadAnnouncements();
    void loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase();

    if (!keyword) {
      return users;
    }

    return users.filter((user) => {
      return (
        user.full_name.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword)
      );
    });
  }, [userSearch, users]);

  const selectedUsers = useMemo(() => {
    return users.filter((user) => form.user_ids.includes(user.id));
  }, [form.user_ids, users]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (form.title.trim().length < 3) {
      setErrorMessage("Title must be at least 3 characters.");
      return;
    }

    if (form.body.trim().length < 10) {
      setErrorMessage("Message must be at least 10 characters.");
      return;
    }

    if (form.send_to === "all" && users.length === 0) {
      setErrorMessage("There are no active recipients available.");
      return;
    }

    if (form.send_to === "selected" && form.user_ids.length === 0) {
      setErrorMessage("Please select at least one recipient before sending.");
      return;
    }

    setIsSubmitting(true);

    try {
      await createAdminAnnouncement(form);
      setForm(initialForm);
      setUserSearch("");
      setSuccessMessage("Announcement sent successfully.");
      await loadAnnouncements();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to publish announcement.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AdminPageLayout activeItem="announcements">
      <section
        style={{
          display: "flex",
          alignItems: "end",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.48)",
              marginBottom: 8,
            }}
          >
            Announcement center
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(2rem, 4vw, 3rem)",
              lineHeight: 0.95,
              fontWeight: 900,
              letterSpacing: "-0.05em",
              textTransform: "uppercase",
            }}
          >
            Send announcements to members
          </h2>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div style={{ ...panelStyle, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                background: "rgba(255,122,26,0.12)",
                color: "#ff9a3d",
              }}
            >
              <Megaphone size={18} />
            </div>
            <div>
              <div style={{ color: "#d4d4d8", fontSize: 14, marginBottom: 6 }}>Sent</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{announcements.length}</div>
            </div>
          </div>
        </div>
        <div style={{ ...panelStyle, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                background: "rgba(59,130,246,0.12)",
                color: "#93c5fd",
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <div style={{ color: "#d4d4d8", fontSize: 14, marginBottom: 6 }}>Active members</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{users.length}</div>
            </div>
          </div>
        </div>
        <div style={{ ...panelStyle, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                display: "grid",
                placeItems: "center",
                background: "rgba(245,158,11,0.12)",
                color: "#fde68a",
              }}
            >
              <BellRing size={18} />
            </div>
            <div>
              <div style={{ color: "#d4d4d8", fontSize: 14, marginBottom: 6 }}>Recipients</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>
                {form.send_to === "all" ? users.length : form.user_ids.length}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : "minmax(0, 1.1fr) minmax(360px, 0.9fr)",
          gap: 18,
          alignItems: "start",
        }}
      >
        <form onSubmit={handleSubmit} style={{ ...panelStyle, display: "grid", gap: 16 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Compose announcement</div>
            <div style={{ color: "#9ca8b7", fontSize: 14 }}>
              Create an announcement record and deliver it to the selected members.
            </div>
          </div>

          {errorMessage ? (
            <div
              style={{
                borderRadius: 14,
                padding: "12px 14px",
                background: "rgba(127,29,29,0.32)",
                color: "#fecaca",
                fontSize: 14,
              }}
            >
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div
              style={{
                borderRadius: 14,
                padding: "12px 14px",
                background: "rgba(22,101,52,0.28)",
                color: "#bbf7d0",
                fontSize: 14,
              }}
            >
              {successMessage}
            </div>
          ) : null}

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: "#d4d4d8", fontSize: 14, fontWeight: 700 }}>Title</span>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Maintenance notice, new class schedule..."
              style={{
                minHeight: 50,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "#f5f5f5",
                padding: "0 14px",
                fontSize: 15,
              }}
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ color: "#d4d4d8", fontSize: 14, fontWeight: 700 }}>Type</span>
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as AnnouncementType,
                  }))
                }
                style={{
                  minHeight: 50,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  color: "#f5f5f5",
                  padding: "0 14px",
                  fontSize: 15,
                  colorScheme: "dark",
                }}
              >
                <option value="announcement" style={darkOptionStyle()}>
                  Announcement
                </option>
                <option value="system" style={darkOptionStyle()}>
                  System
                </option>
                <option value="membership" style={darkOptionStyle()}>
                  Membership
                </option>
                <option value="schedule" style={darkOptionStyle()}>
                  Schedule
                </option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ color: "#d4d4d8", fontSize: 14, fontWeight: 700 }}>Recipients</span>
              <select
                value={form.send_to}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    send_to: event.target.value as AnnouncementTarget,
                    user_ids: event.target.value === "all" ? [] : current.user_ids,
                  }))
                }
                style={{
                  minHeight: 50,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.03)",
                  color: "#f5f5f5",
                  padding: "0 14px",
                  fontSize: 15,
                  colorScheme: "dark",
                }}
              >
                <option value="all" style={darkOptionStyle()}>
                  All active members
                </option>
                <option value="selected" style={darkOptionStyle()}>
                  Select manually
                </option>
              </select>
            </label>
          </div>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: "#d4d4d8", fontSize: 14, fontWeight: 700 }}>Message</span>
            <textarea
              value={form.body}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  body: event.target.value,
                }))
              }
              rows={7}
              placeholder="Enter the content that will be copied into each notification."
              style={{
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "#f5f5f5",
                padding: "14px",
                fontSize: 15,
                resize: "vertical",
              }}
            />
          </label>

          {form.send_to === "selected" ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={{ color: "#d4d4d8", fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                  Select members
                </div>
                <div style={searchBarStyle}>
                  <Users size={18} color="#9ca8b7" />
                  <input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Search by name or email"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      color: "#f5f5f5",
                      fontSize: 15,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  maxHeight: 260,
                  overflowY: "auto",
                  display: "grid",
                  gap: 10,
                  paddingRight: 6,
                }}
              >
                {filteredUsers.map((user) => {
                  const isSelected = form.user_ids.includes(user.id);

                  return (
                    <label
                      key={user.id}
                      style={{
                        display: "flex",
                        alignItems: "start",
                        gap: 12,
                        padding: 14,
                        borderRadius: 14,
                        border: isSelected
                          ? "1px solid rgba(255,122,26,0.36)"
                          : "1px solid rgba(255,255,255,0.08)",
                        background: isSelected
                          ? "rgba(255,122,26,0.08)"
                          : "rgba(255,255,255,0.02)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => {
                          setForm((current) => ({
                            ...current,
                            user_ids: event.target.checked
                              ? [...current.user_ids, user.id]
                              : current.user_ids.filter((id) => id !== user.id),
                          }));
                        }}
                      />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{user.full_name}</div>
                        <div style={{ color: "#9ca8b7", fontSize: 13, marginTop: 4 }}>
                          {user.email}
                        </div>
                      </div>
                    </label>
                  );
                })}

                {!isLoadingUsers && filteredUsers.length === 0 ? (
                  <div
                    style={{
                      borderRadius: 14,
                      padding: 18,
                      border: "1px dashed rgba(255,255,255,0.12)",
                      color: "#9ca8b7",
                      textAlign: "center",
                    }}
                  >
                    No matching members found.
                  </div>
                ) : null}
              </div>

              {selectedUsers.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {selectedUsers.map((user) => (
                    <span
                      key={user.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 12px",
                        borderRadius: 999,
                        background: "rgba(255,122,26,0.12)",
                        border: "1px solid rgba(255,122,26,0.24)",
                        color: "#ffd7b0",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {user.full_name}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div
              style={{
                borderRadius: 14,
                padding: 14,
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.18)",
                color: "#bfdbfe",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              This announcement will be created for all active members.
            </div>
          )}

          <Button
            type="submit"
            isLoading={isSubmitting}
            loadingText="Publishing..."
            style={{ background: "#ff7a1a", color: "#111111", minHeight: 48 }}
            leftIcon={<Send size={16} />}
          >
            Send announcement
          </Button>
        </form>

        <aside style={{ ...panelStyle, display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>History</div>
            <div style={{ color: "#9ca8b7", fontSize: 14 }}>
              Recent announcements and delivery totals.
            </div>
          </div>

          {isLoadingHistory ? (
            <div style={{ color: "#9ca8b7", fontSize: 14 }}>Loading history...</div>
          ) : null}

          {!isLoadingHistory && announcements.length === 0 ? (
            <div
              style={{
                borderRadius: 14,
                padding: 20,
                border: "1px dashed rgba(255,255,255,0.12)",
                color: "#9ca8b7",
              }}
            >
              No announcements have been sent yet.
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 12 }}>
            {announcements.map((announcement) => (
              <article
                key={announcement.id}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "start",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{announcement.title}</div>
                    <div style={{ color: "#9ca8b7", fontSize: 13, marginTop: 4 }}>
                      {formatDate(announcement.published_at)}
                    </div>
                  </div>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 26,
                      padding: "0 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      ...notificationAccent("announcement"),
                    }}
                  >
                    Sent
                  </span>
                </div>

                <div style={{ color: "#d4d4d8", fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
                  {announcement.body}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 12,
                      padding: 12,
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div style={{ color: "#9ca8b7", fontSize: 12, textTransform: "uppercase", marginBottom: 6 }}>
                      Recipients
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{announcement.recipient_count}</div>
                  </div>
                  <div
                    style={{
                      borderRadius: 12,
                      padding: 12,
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div style={{ color: "#9ca8b7", fontSize: 12, textTransform: "uppercase", marginBottom: 6 }}>
                      Read
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>{announcement.read_count}</div>
                  </div>
                  <div
                    style={{
                      borderRadius: 12,
                      padding: 12,
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div style={{ color: "#9ca8b7", fontSize: 12, textTransform: "uppercase", marginBottom: 6 }}>
                      Sender
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      {announcement.created_by_name || "Unknown administrator"}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div
            style={{
              borderRadius: 14,
              padding: 14,
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.18)",
              color: "#fde68a",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontWeight: 800 }}>
              <ShieldAlert size={16} />
              <span>Note</span>
            </div>
            Each send creates one record in `announcements` and one notification per recipient.
          </div>
        </aside>
      </section>
    </AdminPageLayout>
  );
}
