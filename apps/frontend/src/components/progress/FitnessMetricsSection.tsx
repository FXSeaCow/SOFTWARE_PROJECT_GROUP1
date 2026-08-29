import React, { useEffect, useMemo, useState } from "react";
import { Activity, Pencil, Percent, Plus, Ruler, Scale, Trash2 } from "lucide-react";

import { panelStyle, startButtonStyle } from "../main-menu/styles";
import { MainMenuStatCard } from "../main-menu/MainMenuStatCard";
import { ChartPoint, FitnessMetricsChart } from "./FitnessMetricsChart";
import {
  FitnessProgress,
  FitnessRecord,
  createFitnessRecord,
  deleteFitnessRecord,
  getLatestFitnessRecord,
  getMyFitnessProgress,
  listMyFitnessRecords,
  updateFitnessRecord,
} from "../../services/fitnessRecordsService";

function formatDateLabel(dateString: string): string {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatChange(change: number | null, unit: string): string {
  if (change === null) return "No prior record";
  if (change === 0) return `No change`;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}${unit} vs previous`;
}

function bmiCategoryLabel(category: string | null): string {
  if (!category) return "";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 14,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#f5f5f5",
  padding: "0 14px",
  fontSize: 14,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  color: "#9ca8b7",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
  display: "block",
};

export function FitnessMetricsSection() {
  const [records, setRecords] = useState<FitnessRecord[]>([]);
  const [progress, setProgress] = useState<FitnessProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [bodyFatInput, setBodyFatInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editWeightInput, setEditWeightInput] = useState("");
  const [editHeightInput, setEditHeightInput] = useState("");
  const [editBodyFatInput, setEditBodyFatInput] = useState("");
  const [editNotesInput, setEditNotesInput] = useState("");
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function loadData() {
    setIsLoading(true);
    setLoadError(null);

    try {
      const [recordsResult, progressResult, latest] = await Promise.all([
        listMyFitnessRecords({ limit: 20 }),
        getMyFitnessProgress({ limit: 30 }).catch(() => null),
        getLatestFitnessRecord(),
      ]);

      setRecords(recordsResult.records);
      setProgress(progressResult);

      if (latest) {
        setHeightInput((current) => current || String(latest.height_cm ?? ""));
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load fitness records.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latestRecord = progress?.latest_record ?? records[0] ?? null;
  const weightChange = progress?.latest_change?.weight.change ?? null;
  const bmiChange = progress?.latest_change?.bmi.change ?? null;

  const weightSeries: ChartPoint[] = useMemo(
    () =>
      (progress?.trend ?? [])
        .filter((point) => point.weight_kg !== null)
        .map((point) => ({
          label: formatDateLabel(point.recorded_date),
          value: point.weight_kg as number,
          date: point.recorded_date,
        })),
    [progress],
  );

  const bodyFatSeries: ChartPoint[] = useMemo(
    () =>
      (progress?.trend ?? [])
        .filter((point) => point.body_fat_pct !== null)
        .map((point) => ({
          label: formatDateLabel(point.recorded_date),
          value: point.body_fat_pct as number,
          date: point.recorded_date,
        })),
    [progress],
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const weightKg = Number(weightInput);
    const heightCm = Number(heightInput);

    if (!weightKg || weightKg <= 0) {
      setFormError("Enter a valid weight in kg.");
      return;
    }

    if (!heightCm || heightCm <= 0) {
      setFormError("Enter a valid height in cm.");
      return;
    }

    setIsSaving(true);

    try {
      await createFitnessRecord({
        weight_kg: weightKg,
        height_cm: heightCm,
        body_fat_pct: bodyFatInput ? Number(bodyFatInput) : undefined,
        notes: notesInput.trim() || undefined,
      });

      setWeightInput("");
      setBodyFatInput("");
      setNotesInput("");
      setShowForm(false);
      await loadData();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save this record.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(recordId: string) {
    setDeletingId(recordId);

    try {
      await deleteFitnessRecord(recordId);
      await loadData();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to delete this record.");
    } finally {
      setDeletingId(null);
    }
  }

  function startEdit(record: FitnessRecord) {
    setEditingRecordId(record.id);
    setEditWeightInput(record.weight_kg !== null ? String(record.weight_kg) : "");
    setEditHeightInput(record.height_cm !== null ? String(record.height_cm) : "");
    setEditBodyFatInput(record.body_fat_pct !== null ? String(record.body_fat_pct) : "");
    setEditNotesInput(record.notes ?? "");
    setEditError(null);
  }

  function cancelEdit() {
    setEditingRecordId(null);
    setEditError(null);
  }

  async function handleEditSubmit(event: React.FormEvent, recordId: string) {
    event.preventDefault();
    setEditError(null);

    const weightKg = Number(editWeightInput);
    const heightCm = Number(editHeightInput);

    if (!weightKg || weightKg <= 0) {
      setEditError("Enter a valid weight in kg.");
      return;
    }

    if (!heightCm || heightCm <= 0) {
      setEditError("Enter a valid height in cm.");
      return;
    }

    setIsEditSaving(true);

    try {
      await updateFitnessRecord(recordId, {
        weight_kg: weightKg,
        height_cm: heightCm,
        body_fat_pct: editBodyFatInput ? Number(editBodyFatInput) : undefined,
        notes: editNotesInput.trim() || undefined,
      });

      setEditingRecordId(null);
      await loadData();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Unable to update this record.");
    } finally {
      setIsEditSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="interactive-card dashboard-card-enter" style={{ ...panelStyle, marginBottom: 24 }}>
        <div style={{ color: "#8d98a7", fontSize: 14 }}>Loading fitness metrics...</div>
      </section>
    );
  }

  return (
    <>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <MainMenuStatCard
          label="Current weight"
          value={latestRecord?.weight_kg ? `${latestRecord.weight_kg} kg` : "—"}
          icon={<Scale size={18} />}
          note={formatChange(weightChange, " kg")}
        />
        <MainMenuStatCard
          label="BMI"
          value={latestRecord?.bmi ? latestRecord.bmi.toFixed(1) : "—"}
          icon={<Activity size={18} />}
          note={latestRecord?.bmi_category ? bmiCategoryLabel(latestRecord.bmi_category) : formatChange(bmiChange, "")}
        />
        <MainMenuStatCard
          label="Body fat"
          value={latestRecord?.body_fat_pct ? `${latestRecord.body_fat_pct}%` : "—"}
          icon={<Percent size={18} />}
          note="Latest measurement"
        />
        <MainMenuStatCard
          label="Height"
          value={latestRecord?.height_cm ? `${latestRecord.height_cm} cm` : "—"}
          icon={<Ruler size={18} />}
          note="Latest measurement"
        />
      </section>

      <section className="interactive-card dashboard-card-enter" style={{ ...panelStyle, marginBottom: 24 }}>
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
          <div style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.03em" }}>
            Weight Trend
          </div>
          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            style={{ ...startButtonStyle, minHeight: 40 }}
          >
            <Plus size={16} />
            {showForm ? "Cancel" : "Log measurement"}
          </button>
        </div>

        {showForm ? (
          <form onSubmit={handleSubmit} style={{ marginBottom: 22 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <label>
                <span style={labelStyle}>Weight (kg)</span>
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="500"
                  value={weightInput}
                  onChange={(event) => setWeightInput(event.target.value)}
                  style={inputStyle}
                  required
                />
              </label>

              <label>
                <span style={labelStyle}>Height (cm)</span>
                <input
                  type="number"
                  step="0.1"
                  min="80"
                  max="250"
                  value={heightInput}
                  onChange={(event) => setHeightInput(event.target.value)}
                  style={inputStyle}
                  required
                />
              </label>

              <label>
                <span style={labelStyle}>Body fat % (optional)</span>
                <input
                  type="number"
                  step="0.1"
                  min="2"
                  max="75"
                  value={bodyFatInput}
                  onChange={(event) => setBodyFatInput(event.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>

            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={labelStyle}>Notes (optional)</span>
              <input
                type="text"
                maxLength={500}
                value={notesInput}
                onChange={(event) => setNotesInput(event.target.value)}
                style={inputStyle}
                placeholder="e.g. Morning weigh-in, post-workout"
              />
            </label>

            {formError ? (
              <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 14 }}>{formError}</div>
            ) : null}

            <button type="submit" disabled={isSaving} style={{ ...startButtonStyle, opacity: isSaving ? 0.6 : 1 }}>
              {isSaving ? "Saving..." : "Save measurement"}
            </button>
          </form>
        ) : null}

        {loadError ? <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 14 }}>{loadError}</div> : null}

        <FitnessMetricsChart
          points={weightSeries}
          unit="kg"
          emptyMessage="Add another body measurement to see your weight trend."
        />
      </section>

      <section className="interactive-card dashboard-card-enter" style={{ ...panelStyle, marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.03em", marginBottom: 18 }}>
          Body Fat Trend
        </div>

        <FitnessMetricsChart
          points={bodyFatSeries}
          unit="%"
          accent="#4fa3ff"
          emptyMessage="Add another body measurement to see your body fat trend."
        />
      </section>

      <section className="interactive-card dashboard-card-enter" style={{ ...panelStyle, marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.03em", marginBottom: 18 }}>
          Measurement History
        </div>

        {records.length === 0 ? (
          <div style={{ color: "#8d98a7", fontSize: 14 }}>No fitness records logged yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {records.map((record) =>
              editingRecordId === record.id ? (
                <form
                  key={record.id}
                  onSubmit={(event) => void handleEditSubmit(event, record.id)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: "rgba(255,122,26,0.05)",
                    border: "1px solid rgba(255,122,26,0.18)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <label>
                      <span style={labelStyle}>Weight (kg)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={editWeightInput}
                        onChange={(event) => setEditWeightInput(event.target.value)}
                        style={inputStyle}
                        required
                      />
                    </label>
                    <label>
                      <span style={labelStyle}>Height (cm)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={editHeightInput}
                        onChange={(event) => setEditHeightInput(event.target.value)}
                        style={inputStyle}
                        required
                      />
                    </label>
                    <label>
                      <span style={labelStyle}>Body fat %</span>
                      <input
                        type="number"
                        step="0.1"
                        value={editBodyFatInput}
                        onChange={(event) => setEditBodyFatInput(event.target.value)}
                        style={inputStyle}
                      />
                    </label>
                  </div>

                  <label style={{ display: "block", marginBottom: 10 }}>
                    <span style={labelStyle}>Notes</span>
                    <input
                      type="text"
                      maxLength={500}
                      value={editNotesInput}
                      onChange={(event) => setEditNotesInput(event.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  {editError ? (
                    <div style={{ color: "#fca5a5", fontSize: 13, marginBottom: 10 }}>{editError}</div>
                  ) : null}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="submit"
                      disabled={isEditSaving}
                      style={{ ...startButtonStyle, minHeight: 38, opacity: isEditSaving ? 0.6 : 1 }}
                    >
                      {isEditSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
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
              ) : (
                <div
                  key={record.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: 4, minWidth: 120 }}>
                    <div style={{ color: "#f5f5f5", fontSize: 15, fontWeight: 800 }}>
                      {formatDateLabel(record.recorded_date)}
                    </div>
                    {record.notes ? (
                      <div style={{ color: "#8d98a7", fontSize: 12 }}>{record.notes}</div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#d3dae5", fontSize: 13, fontWeight: 700 }}>
                        {record.weight_kg ?? "—"} kg
                      </div>
                      <div style={{ color: "#8d98a7", fontSize: 11 }}>Weight</div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#d3dae5", fontSize: 13, fontWeight: 700 }}>
                        {record.bmi ? record.bmi.toFixed(1) : "—"}
                      </div>
                      <div style={{ color: "#8d98a7", fontSize: 11 }}>BMI</div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#d3dae5", fontSize: 13, fontWeight: 700 }}>
                        {record.body_fat_pct ? `${record.body_fat_pct}%` : "—"}
                      </div>
                      <div style={{ color: "#8d98a7", fontSize: 11 }}>Body fat</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => startEdit(record)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#8d98a7",
                        cursor: "pointer",
                        padding: 6,
                      }}
                      aria-label="Edit record"
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDelete(record.id)}
                      disabled={deletingId === record.id}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#8d98a7",
                        cursor: "pointer",
                        padding: 6,
                        opacity: deletingId === record.id ? 0.5 : 1,
                      }}
                      aria-label="Delete record"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </>
  );
}
