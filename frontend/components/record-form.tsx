"use client";
import { useState, type FormEvent } from "react";
import {
  X,
  Loader2,
  CalendarPlus,
  UserRoundPlus,
  Stethoscope,
} from "lucide-react";
import {
  api,
  dateKey,
  type Appointment,
  type Doctor,
  type Entity,
  type Patient,
} from "@/lib/types";
export type EditRecord = Partial<Patient & Doctor & Appointment>;
export function RecordForm({
  entity,
  record,
  patients,
  doctors,
  onClose,
  onSaved,
}: {
  entity: Entity;
  record?: EditRecord;
  patients: Patient[];
  doctors: Doctor[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const title =
    entity === "patients"
      ? "patient"
      : entity === "doctors"
        ? "doctor"
        : "appointment";
  const Icon =
    entity === "patients"
      ? UserRoundPlus
      : entity === "doctors"
        ? Stethoscope
        : CalendarPlus;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const values: Record<string, unknown> = Object.fromEntries(
      new FormData(event.currentTarget),
    );
    if (entity === "appointments") {
      values.patientId = Number(values.patientId);
      values.doctorId = Number(values.doctorId);
      values.duration = Number(values.duration);
    }
    try {
      await api(`${entity}${record?.id ? `/${record.id}` : ""}`, {
        method: record?.id ? "PATCH" : "POST",
        body: JSON.stringify(values),
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <div className="modal-icon">
            <Icon size={23} />
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="form-title">
          {record?.id ? "Edit" : "New"} {title}
        </h2>
        <p className="muted">
          {entity === "appointments"
            ? "Make room for better care. Schedule a visit below."
            : `Keep your ${title} information organized and up to date.`}
        </p>
        <form onSubmit={submit}>
          <div className="form-grid">
            {entity === "appointments" ? (
              <>
                <label className="span-2">
                  Patient
                  <select
                    name="patientId"
                    defaultValue={record?.patientId || ""}
                    required
                    autoFocus
                  >
                    <option value="" disabled>
                      Select a patient
                    </option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="span-2">
                  Doctor
                  <select
                    name="doctorId"
                    defaultValue={record?.doctorId || ""}
                    required
                  >
                    <option value="" disabled>
                      Select a doctor
                    </option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · {d.specialty}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    name="date"
                    defaultValue={record?.date || dateKey(new Date())}
                    required
                  />
                </label>
                <label>
                  Time
                  <input
                    type="time"
                    name="time"
                    defaultValue={record?.time || "09:00"}
                    required
                  />
                </label>
                <label>
                  Duration
                  <select name="duration" defaultValue={record?.duration || 30}>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                  </select>
                </label>
                <label>
                  Status
                  <select
                    name="status"
                    defaultValue={record?.status || "Scheduled"}
                  >
                    {["Scheduled", "Confirmed", "Completed", "Cancelled"].map(
                      (s) => (
                        <option key={s}>{s}</option>
                      ),
                    )}
                  </select>
                </label>
                <label className="span-2">
                  Reason for visit
                  <input
                    name="reason"
                    defaultValue={record?.reason || ""}
                    placeholder="e.g. Annual health checkup"
                    required
                    maxLength={250}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="span-2">
                  Full name
                  <input
                    name="name"
                    defaultValue={record?.name || ""}
                    placeholder={
                      entity === "doctors"
                        ? "Dr. Sarah Mitchell"
                        : "e.g. Alex Johnson"
                    }
                    required
                    maxLength={100}
                    autoFocus
                  />
                </label>
                <label>
                  Email address
                  <input
                    type="email"
                    name="email"
                    defaultValue={record?.email || ""}
                    placeholder="name@example.com"
                    required
                    maxLength={150}
                  />
                </label>
                <label>
                  Phone number
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={record?.phone || ""}
                    placeholder="+1 (555) 000-0000"
                    required
                    maxLength={30}
                  />
                </label>
                {entity === "patients" ? (
                  <>
                    <label>
                      Date of birth
                      <input
                        name="dateOfBirth"
                        type="date"
                        defaultValue={record?.dateOfBirth || ""}
                        max={dateKey(new Date())}
                        required
                      />
                    </label>
                    <label>
                      Gender
                      <select
                        name="gender"
                        defaultValue={record?.gender || ""}
                        required
                      >
                        <option value="" disabled>
                          Select gender
                        </option>
                        {["Female", "Male", "Other", "Prefer not to say"].map(
                          (s) => (
                            <option key={s}>{s}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      Blood group
                      <select
                        name="bloodGroup"
                        defaultValue={record?.bloodGroup || "Unknown"}
                      >
                        {[
                          "Unknown",
                          "A+",
                          "A-",
                          "B+",
                          "B-",
                          "AB+",
                          "AB-",
                          "O+",
                          "O-",
                        ].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Address
                      <input
                        name="address"
                        defaultValue={record?.address || ""}
                        placeholder="City, street, postal code"
                        maxLength={300}
                      />
                    </label>
                    <label className="span-2">
                      Clinical notes{" "}
                      <span className="optional">(optional)</span>
                      <textarea
                        name="notes"
                        defaultValue={record?.notes || ""}
                        placeholder="Allergies, medical history, or other details…"
                        rows={3}
                        maxLength={3000}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Specialty
                      <input
                        name="specialty"
                        defaultValue={record?.specialty || ""}
                        list="specialties"
                        placeholder="Select or enter specialty"
                        required
                        maxLength={100}
                      />
                      <datalist id="specialties">
                        {[
                          "General Medicine",
                          "Cardiology",
                          "Dermatology",
                          "Pediatrics",
                          "Neurology",
                          "Orthopedics",
                        ].map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </label>
                    <label>
                      Profile color
                      <select
                        name="color"
                        defaultValue={record?.color || "sage"}
                      >
                        {["sage", "blue", "peach", "lavender"].map((s) => (
                          <option key={s} value={s}>
                            {s[0].toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </>
            )}
          </div>
          {error && (
            <div role="alert" className="form-error">
              {error}
            </div>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={saving}>
              {saving ? <Loader2 size={16} className="spin" /> : null}
              {saving
                ? "Saving…"
                : record?.id
                  ? "Save changes"
                  : `Add ${title}`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
