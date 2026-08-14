import React, { useEffect, useState } from "react";

import { Modal } from "./Modal";
import { startButtonStyle } from "./main-menu/styles";
import { AdminBranch, BranchInput } from "../services/occupancyService";

const fieldStyle: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
  color: "#f5f5f5",
  padding: "0 12px",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#9ca8b7",
  marginBottom: 6,
  display: "block",
};

function toFormState(branch: AdminBranch | null): BranchInput {
  return {
    name: branch?.branch_name ?? "",
    address: branch?.address ?? "",
    city: branch?.city ?? "",
    phone: branch?.phone ?? "",
    opening_time: branch?.opening_time ? branch.opening_time.slice(0, 5) : "",
    closing_time: branch?.closing_time ? branch.closing_time.slice(0, 5) : "",
    capacity: branch?.capacity ?? 100,
  };
}

export function BranchFormModal({
  isOpen,
  branch,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  branch: AdminBranch | null;
  onClose: () => void;
  onSubmit: (data: BranchInput) => Promise<void>;
}) {
  const [form, setForm] = useState<BranchInput>(() => toFormState(branch));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm(toFormState(branch));
      setError(null);
    }
  }, [isOpen, branch]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Branch name is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        address: form.address?.trim() || null,
        city: form.city?.trim() || null,
        phone: form.phone?.trim() || null,
        opening_time: form.opening_time || null,
        closing_time: form.closing_time || null,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save this branch.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#f5f5f5" }}>
          {branch ? "Edit branch" : "Add branch"}
        </div>

        {error ? (
          <div style={{ borderRadius: 10, padding: 10, background: "rgba(127,29,29,0.28)", color: "#fecaca", fontSize: 13 }}>
            {error}
          </div>
        ) : null}

        <div>
          <label style={labelStyle}>Branch name</label>
          <input
            style={fieldStyle}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="e.g. District 1 Branch"
            required
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Address</label>
            <input
              style={fieldStyle}
              value={form.address ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Street address"
            />
          </div>
          <div>
            <label style={labelStyle}>City</label>
            <input
              style={fieldStyle}
              value={form.city ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              placeholder="City"
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              style={fieldStyle}
              value={form.phone ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="Phone number"
            />
          </div>
          <div>
            <label style={labelStyle}>Capacity</label>
            <input
              type="number"
              min={1}
              max={10000}
              style={fieldStyle}
              value={form.capacity ?? 100}
              onChange={(event) =>
                setForm((current) => ({ ...current, capacity: Number(event.target.value) || 1 }))
              }
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Opening time</label>
            <input
              type="time"
              style={{ ...fieldStyle, colorScheme: "dark" }}
              value={form.opening_time ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, opening_time: event.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Closing time</label>
            <input
              type="time"
              style={{ ...fieldStyle, colorScheme: "dark" }}
              value={form.closing_time ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, closing_time: event.target.value }))}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              minHeight: 44,
              padding: "0 20px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent",
              color: "#d3dae5",
              fontWeight: 700,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              ...startButtonStyle,
              width: "auto",
              opacity: isSubmitting ? 0.6 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "Saving..." : branch ? "Save changes" : "Add branch"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
