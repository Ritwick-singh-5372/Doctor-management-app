"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  HelpCircle,
  LayoutDashboard,
  Loader2,
  Mail,
  Menu,
  Pencil,
  Phone,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  api,
  dateKey,
  displayDate,
  displayTime,
  initials,
  localDate,
  type Appointment,
  type Doctor,
  type Entity,
  type Patient,
  type Section,
} from "@/lib/types";
import { RecordForm, type EditRecord } from "@/components/record-form";
const sections: { name: Section; icon: typeof Users }[] = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Appointments", icon: CalendarDays },
  { name: "Patients", icon: Users },
  { name: "Doctors", icon: Stethoscope },
];
const colors = ["sage", "peach", "lavender", "blue", "pink"];
function Avatar({
  name,
  color,
  size = "",
}: {
  name: string;
  color?: string;
  size?: string;
}) {
  return (
    <span
      className={`avatar ${color || colors[name.length % colors.length]} ${size}`}
    >
      {initials(name)}
    </span>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      <span />
      {status}
    </span>
  );
}
function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty">
      <CalendarDays size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export default function Home() {
  const [section, setSection] = useState<Section>("Overview");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const [specialty, setSpecialty] = useState("All specialties");
  const [selectedDay, setSelectedDay] = useState(dateKey(new Date()));
  const [appointmentDay, setAppointmentDay] = useState("");
  const [form, setForm] = useState<{
    entity: Entity;
    record?: EditRecord;
  } | null>(null);
  const [detail, setDetail] = useState<Patient | null>(null);
  const [help, setHelp] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [toast, setToast] = useState("");
  const [removing, setRemoving] = useState<{
    entity: Entity;
    id: number;
    name: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try {
      const [p, d, a] = await Promise.all([
        api<Patient[]>("patients"),
        api<Doctor[]>("doctors"),
        api<Appointment[]>("appointments"),
      ]);
      setPatients(p);
      setDoctors(d);
      setAppointments(a);
      setError("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setForm(null);
        setDetail(null);
        setHelp(false);
        setNotifications(false);
        setRemoving(null);
        setSidebar(false);
      }
    }
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, []);
  useEffect(() => {
    if (!form && !detail && !help && !removing) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, select, textarea, a[href]",
        ) || [],
      );
    const initial =
      dialog?.querySelector<HTMLElement>("input, select, textarea") ||
      focusable()[0];
    initial?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const nodes = focusable();
      if (!nodes.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [form, detail, help, removing]);
  function navigate(name: Section) {
    setSection(name);
    setSearch("");
    setSidebar(false);
    setFilter("All statuses");
    setSpecialty("All specialties");
    setAppointmentDay("");
  }
  async function saved() {
    const refreshed = await load();
    setToast(
      refreshed
        ? "Changes saved successfully"
        : "Saved, but records could not refresh. Please try again.",
    );
  }
  const dayAppointments = appointments
    .filter((a) => a.date === selectedDay)
    .sort((a, b) => a.time.localeCompare(b.time));
  const today = dateKey(new Date());
  const nextAppointments = appointments
    .filter(
      (a) =>
        (a.date > today ||
          (a.date === today &&
            a.time >= new Date().toTimeString().slice(0, 5))) &&
        ["Scheduled", "Confirmed"].includes(a.status),
    )
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const specialties = Array.from(
    new Set(doctors.map((d) => d.specialty)),
  ).sort();
  const filteredPatients = patients.filter((p) =>
    `${p.name} ${p.email} ${p.phone}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredDoctors = doctors.filter(
    (d) =>
      `${d.name} ${d.specialty}`.toLowerCase().includes(search.toLowerCase()) &&
      (specialty === "All specialties" || d.specialty === specialty),
  );
  const filteredAppointments = appointments
    .filter(
      (a) =>
        `${a.patientName} ${a.doctorName} ${a.reason}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (filter === "All statuses" || a.status === filter) &&
        (!appointmentDay || a.date === appointmentDay),
    )
    .sort(
      (a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time),
    );
  const weekly = useMemo(() => {
    const date = localDate(selectedDay);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(date);
      day.setDate(day.getDate() + i);
      const key = dateKey(day);
      return {
        key,
        label: day.toLocaleDateString("en-US", { weekday: "short" }),
        count: appointments.filter(
          (a) => a.date === key && a.status !== "Cancelled",
        ).length,
      };
    });
  }, [selectedDay, appointments]);
  async function updateStatus(a: Appointment, status: string) {
    try {
      await api(`appointments/${a.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await saved();
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  async function remove() {
    if (!removing) return;
    setBusy(true);
    setDeleteError("");
    try {
      await api(`${removing.entity}/${removing.id}`, { method: "DELETE" });
      await saved();
      setRemoving(null);
      setDetail(null);
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function confirmDelete(entity: Entity, id: number, name: string) {
    setRemoving({ entity, id, name });
    setDeleteError("");
  }
  function shiftDay(amount: number) {
    const d = localDate(selectedDay);
    d.setDate(d.getDate() + amount);
    setSelectedDay(dateKey(d));
  }
  function appointmentTable(rows: Appointment[], compact = false) {
    return rows.length ? (
      <div className="table-scroll">
        <table className="appointment-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Doctor</th>
              <th>{compact ? "Time" : "Date & time"}</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="person-cell">
                    <Avatar name={a.patientName} />
                    <div>
                      <button
                        className="text-button person-name"
                        onClick={() =>
                          setDetail(
                            patients.find((p) => p.id === a.patientId) || null,
                          )
                        }
                      >
                        {a.patientName}
                      </button>
                      <span>{a.reason}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="doctor-cell">
                    <span
                      className="doctor-dot"
                      style={{
                        background:
                          doctors.find((d) => d.id === a.doctorId)?.color ===
                          "blue"
                            ? "#98bad3"
                            : undefined,
                      }}
                    />
                    <div>
                      <strong>{a.doctorName}</strong>
                      <span>{a.specialty}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="time-cell">
                    {!compact && <strong>{displayDate(a.date)}</strong>}
                    <span>
                      {displayTime(a.time)}
                      {compact && <small> · {a.duration} min</small>}
                    </span>
                  </div>
                </td>
                <td>
                  <Badge status={a.status} />
                </td>
                <td>
                  <div className="row-actions">
                    {["Scheduled", "Confirmed"].includes(a.status) && (
                      <button
                        title="Mark completed"
                        aria-label={`Mark ${a.patientName}'s appointment completed`}
                        className="icon-button complete"
                        onClick={() => void updateStatus(a, "Completed")}
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      className="icon-button"
                      aria-label={`Edit appointment for ${a.patientName}`}
                      onClick={() =>
                        setForm({ entity: "appointments", record: a })
                      }
                    >
                      <Pencil size={15} />
                    </button>
                    {!compact && (
                      <button
                        className="icon-button danger"
                        aria-label={`Delete appointment for ${a.patientName}`}
                        onClick={() =>
                          confirmDelete(
                            "appointments",
                            a.id,
                            `${a.patientName}’s appointment`,
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="A little room in the schedule"
        description="No appointments match this view. Book a visit to get started."
      />
    );
  }
  return (
    <div className="app-shell">
      {sidebar && (
        <div className="sidebar-scrim" onClick={() => setSidebar(false)} />
      )}
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Overview");
          }}
        >
          <span className="brand-icon">
            <Plus size={24} strokeWidth={3} />
          </span>
          careflow<span className="brand-period">.</span>
        </a>
        <div className="workspace">
          <span className="clinic-icon">
            <Heart size={19} />
          </span>
          <div>
            <strong>Evergreen Clinic</strong>
            <span>Clinic workspace</span>
          </div>
          <span className="workspace-dot" title="Clinic workspace" />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {sections.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${section === name ? "active" : ""}`}
              onClick={() => navigate(name)}
            >
              <Icon size={19} />
              <span>{name}</span>
              {name === "Appointments" &&
                appointments.filter((a) => a.date === today).length > 0 && (
                  <span className="nav-count">
                    {appointments.filter((a) => a.date === today).length}
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="care-note">
            <span className="little-spark">✦</span>
            <h4>
              A little more care.
              <br />A lot less paperwork.
            </h4>
            <p>Your day, beautifully organized.</p>
            <div className="care-line">
              <span />
              <Heart size={18} />
              <span />
            </div>
          </div>
          <button
            className="nav-item help-button"
            onClick={() => setHelp(true)}
          >
            <HelpCircle size={19} />
            Help & getting started
            <ArrowUpRight size={15} />
          </button>
          <div className="sidebar-profile">
            <Avatar name="Evergreen Admin" color="peach" />
            <div>
              <strong>Clinic Admin</strong>
              <span>Evergreen Clinic</span>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open menu"
              onClick={() => setSidebar(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{section}</strong>
          </div>
          <div className="topbar-right">
            <div className="global-search">
              <Search size={17} />
              <input
                ref={searchRef}
                aria-label="Search records"
                placeholder="Search anything…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd>⌘ K</kbd>
            </div>
            <div className="notification-wrap">
              <button
                className={`icon-button notification ${notifications ? "selected" : ""}`}
                aria-label="View upcoming appointments"
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={20} />
                {nextAppointments.length > 0 && <i />}
              </button>
              {notifications && (
                <div className="notification-panel">
                  <h3>
                    Coming up next <span>{nextAppointments.length}</span>
                  </h3>
                  {nextAppointments.slice(0, 4).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        navigate("Appointments");
                        setSearch(a.patientName);
                        setNotifications(false);
                      }}
                    >
                      <Avatar name={a.patientName} />
                      <div>
                        <strong>{a.patientName}</strong>
                        <span>
                          {displayDate(a.date)} · {displayTime(a.time)}
                        </span>
                      </div>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                  {!nextAppointments.length && (
                    <p className="muted">
                      You’re all caught up. No upcoming visits.
                    </p>
                  )}
                </div>
              )}
            </div>
            <span className="header-divider" />
            <Avatar name="Evergreen Admin" color="peach" size="small" />
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR CLINIC, CONNECTED</div>
              <h1>
                {section === "Overview"
                  ? "A good day to make a difference."
                  : section}
              </h1>
              <p>
                {section === "Overview"
                  ? "Here’s what’s happening at Evergreen Clinic today."
                  : section === "Patients"
                    ? "Every patient, every detail. Better care starts here."
                    : section === "Doctors"
                      ? "Meet the people making a difference, every day."
                      : "A clear schedule. More time for meaningful care."}
              </p>
            </div>
            <div className="heading-actions">
              {section === "Overview" && (
                <div className="today-label">
                  <CalendarDays size={16} />
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              )}
              <button
                className="button primary"
                onClick={() =>
                  setForm({
                    entity:
                      section === "Patients"
                        ? "patients"
                        : section === "Doctors"
                          ? "doctors"
                          : "appointments",
                  })
                }
              >
                <Plus size={18} />
                {section === "Patients"
                  ? "Add patient"
                  : section === "Doctors"
                    ? "Add doctor"
                    : "New appointment"}
              </button>
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <div>
                <strong>We couldn’t connect to your clinic.</strong>
                <p>{error}</p>
              </div>
              <button
                className="button secondary"
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
              >
                Try again
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-state">
              <Loader2 className="spin" size={30} />
              <p>Getting your clinic ready…</p>
            </div>
          ) : (
            <>
              {section === "Overview" ? (
                <>
                  {search ? (
                    <section className="panel search-results">
                      <div className="panel-heading">
                        <h2>Search results for “{search}”</h2>
                        <button
                          className="text-button"
                          onClick={() => setSearch("")}
                        >
                          Clear search
                        </button>
                      </div>
                      <div className="search-result-grid">
                        <div>
                          <h4>Patients</h4>
                          {filteredPatients.slice(0, 5).map((p) => (
                            <button
                              key={p.id}
                              className="search-result"
                              onClick={() => setDetail(p)}
                            >
                              <Avatar name={p.name} />
                              <span>{p.name}</span>
                              <ArrowRight size={16} />
                            </button>
                          ))}
                          {!filteredPatients.length && (
                            <p className="muted">No patients found</p>
                          )}
                        </div>
                        <div>
                          <h4>Doctors</h4>
                          {filteredDoctors.slice(0, 5).map((d) => (
                            <button
                              key={d.id}
                              className="search-result"
                              onClick={() => {
                                navigate("Doctors");
                                setSearch(d.name);
                              }}
                            >
                              <Avatar name={d.name} color={d.color} />
                              <span>{d.name}</span>
                              <ArrowRight size={16} />
                            </button>
                          ))}
                          {!filteredDoctors.length && (
                            <p className="muted">No doctors found</p>
                          )}
                        </div>
                      </div>
                    </section>
                  ) : null}
                  <section className="welcome-card">
                    <div className="welcome-copy">
                      <span className="welcome-tag">
                        <span /> PEOPLE FIRST. ALWAYS.
                      </span>
                      <h2>
                        A healthier community
                        <br />
                        starts with a little care.
                      </h2>
                      <p>
                        Keep the details in one place, so you can focus
                        <br className="desktop-break" /> on what matters most —
                        your patients.
                      </p>
                      <button onClick={() => navigate("Patients")}>
                        Explore your patients <ArrowRight size={17} />
                      </button>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="art-dot one" />
                      <div className="art-dot two" />
                      <div className="art-plus">+</div>
                      <div className="heart-card">
                        <Heart size={63} strokeWidth={1.4} />
                        <svg viewBox="0 0 160 45">
                          <path d="M0 25h35l8-11 12 28 15-37 14 28 8-8h68" />
                        </svg>
                        <span>A little care goes a long way</span>
                      </div>
                      <div className="floating-card">
                        <span>
                          <CheckCheck size={19} />
                        </span>
                        <div>
                          Care, connected.<small>Every step of the way.</small>
                        </div>
                      </div>
                      <div className="leaf leaf-one" />
                      <div className="leaf leaf-two" />
                    </div>
                  </section>
                  <section
                    className="stats-grid"
                    aria-label="Clinic statistics"
                  >
                    {[
                      {
                        label: "Total patients",
                        value: patients.length,
                        icon: Users,
                        color: "sage",
                        meta: "Registered with your clinic",
                        tag: "Patient directory",
                      },
                      {
                        label: "Today’s appointments",
                        value: appointments.filter(
                          (a) => a.date === today && a.status !== "Cancelled",
                        ).length,
                        icon: CalendarDays,
                        color: "blue",
                        meta: `${appointments.filter((a) => a.date === today && a.status === "Confirmed").length} confirmed for today`,
                        tag: "Today’s schedule",
                      },
                      {
                        label: "Care team",
                        value: doctors.length,
                        icon: Stethoscope,
                        color: "lavender",
                        meta: `Across ${specialties.length} specialties`,
                        tag: "Here to help",
                      },
                      {
                        label: "Completed visits",
                        value: appointments.filter(
                          (a) => a.status === "Completed",
                        ).length,
                        icon: CheckCheck,
                        color: "peach",
                        meta: "One visit. A lasting difference.",
                        tag: "All time",
                      },
                    ].map(
                      ({ label, value, icon: Icon, color, meta, tag }, i) => (
                        <button
                          className="stat-card"
                          key={label}
                          onClick={() => {
                            navigate(
                              i === 0
                                ? "Patients"
                                : i === 2
                                  ? "Doctors"
                                  : "Appointments",
                            );
                            if (i === 3) setFilter("Completed");
                            if (i === 1) setAppointmentDay(today);
                          }}
                        >
                          <div className="stat-top">
                            <span>{label}</span>
                            <span className={`stat-icon ${color}`}>
                              <Icon size={19} />
                            </span>
                          </div>
                          <div className="stat-value">
                            {String(value).padStart(2, "0")}
                            <svg
                              className={`sparkline spark-${color}`}
                              viewBox="0 0 85 32"
                            >
                              <path
                                d={
                                  i % 2
                                    ? "M1 27L13 20L25 23L36 10L48 16L59 9L70 12L84 2"
                                    : "M1 25L13 26L25 17L36 21L48 10L59 15L70 6L84 3"
                                }
                              />
                            </svg>
                          </div>
                          <div className="stat-bottom">
                            <span className="stat-tag">
                              <ArrowUpRight size={12} />
                              {tag}
                            </span>
                            <span>{meta}</span>
                          </div>
                        </button>
                      ),
                    )}
                  </section>
                  <div className="dashboard-grid">
                    <section className="panel appointments-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>
                            Appointments{" "}
                            <span className="count-pill">
                              {dayAppointments.length}
                            </span>
                          </h2>
                          <p>A little planning for a day of better care.</p>
                        </div>
                        <button
                          className="text-button green"
                          onClick={() => navigate("Appointments")}
                        >
                          View all <ArrowRight size={15} />
                        </button>
                      </div>
                      <div className="schedule-toolbar">
                        <div className="date-navigation">
                          <button
                            className="icon-button"
                            aria-label="Previous day"
                            onClick={() => shiftDay(-1)}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <label className="selected-date">
                            <CalendarDays size={15} />
                            <span>
                              {selectedDay === today ? "Today, " : ""}
                              {displayDate(selectedDay)}
                            </span>
                            <input
                              aria-label="Appointment day"
                              type="date"
                              value={selectedDay}
                              onChange={(e) =>
                                e.target.value && setSelectedDay(e.target.value)
                              }
                            />
                            <ChevronDown size={13} />
                          </label>
                          <button
                            className="icon-button"
                            aria-label="Next day"
                            onClick={() => shiftDay(1)}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                        <span className="schedule-summary">
                          <span />
                          {
                            dayAppointments.filter(
                              (a) => a.status !== "Cancelled",
                            ).length
                          }{" "}
                          visits scheduled
                        </span>
                      </div>
                      {appointmentTable(dayAppointments, true)}
                      <div className="table-footer">
                        <span>
                          Every appointment is a chance to make a difference.
                        </span>
                        <Heart size={13} />
                      </div>
                    </section>
                    <aside className="dashboard-aside">
                      <section className="panel week-panel">
                        <div className="panel-heading">
                          <div>
                            <h2>A week of care</h2>
                            <p>
                              {displayDate(weekly[0].key)} –{" "}
                              {displayDate(weekly[6].key)}
                            </p>
                          </div>
                          <span className="stat-icon sage">
                            <Activity size={18} />
                          </span>
                        </div>
                        <div className="week-total">
                          {weekly.reduce((s, d) => s + d.count, 0)}
                          <span>scheduled visits</span>
                        </div>
                        <div className="week-chart">
                          {weekly.map((day) => (
                            <button
                              key={day.key}
                              className={`chart-column ${day.key === selectedDay ? "selected" : ""}`}
                              onClick={() => setSelectedDay(day.key)}
                              aria-label={`${day.label}, ${day.count} visits`}
                            >
                              <span className="chart-number">{day.count}</span>
                              <span className="bar-track">
                                <span
                                  className="bar"
                                  style={{
                                    height: `${Math.max((day.count / Math.max(...weekly.map((d) => d.count), 1)) * 100, 5)}%`,
                                  }}
                                />
                              </span>
                              <span className="chart-label">
                                {day.label[0]}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="chart-legend">
                          <span />
                          Appointments this week
                        </div>
                      </section>
                      <section className="panel team-panel">
                        <div className="panel-heading">
                          <h2>Your care team</h2>
                          <button
                            className="text-button green"
                            onClick={() => navigate("Doctors")}
                            aria-label="View all doctors"
                          >
                            <ArrowUpRight size={18} />
                          </button>
                        </div>
                        {doctors.slice(0, 3).map((d) => (
                          <button
                            className="team-member"
                            key={d.id}
                            onClick={() => {
                              navigate("Doctors");
                              setSearch(d.name);
                            }}
                          >
                            <Avatar name={d.name} color={d.color} />
                            <div>
                              <strong>{d.name}</strong>
                              <span>{d.specialty}</span>
                            </div>
                            <span className="member-dot" />
                          </button>
                        ))}
                        {!doctors.length && (
                          <p className="muted team-empty">
                            Add your first doctor to build your team.
                          </p>
                        )}
                        <button
                          className="team-link"
                          onClick={() => navigate("Doctors")}
                        >
                          Meet the whole team <ArrowRight size={14} />
                        </button>
                      </section>
                    </aside>
                  </div>
                </>
              ) : section === "Patients" ? (
                <section className="panel directory-panel">
                  <div className="directory-toolbar">
                    <div>
                      <h2>
                        Patient directory{" "}
                        <span className="count-pill">{patients.length}</span>
                      </h2>
                      <p>A familiar face. A complete picture.</p>
                    </div>
                    <div className="inline-search">
                      <Search size={16} />
                      <input
                        aria-label="Search patients"
                        placeholder="Search patients…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  {filteredPatients.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Patient</th>
                            <th>Contact details</th>
                            <th>Gender / Age</th>
                            <th>Blood group</th>
                            <th>Visits</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPatients.map((p) => {
                            const birth = localDate(p.dateOfBirth);
                            const now = new Date();
                            const age =
                              now.getFullYear() -
                              birth.getFullYear() -
                              (now.getMonth() < birth.getMonth() ||
                              (now.getMonth() === birth.getMonth() &&
                                now.getDate() < birth.getDate())
                                ? 1
                                : 0);
                            return (
                              <tr key={p.id}>
                                <td>
                                  <div className="person-cell">
                                    <Avatar name={p.name} />
                                    <div>
                                      <button
                                        className="text-button person-name"
                                        onClick={() => setDetail(p)}
                                      >
                                        {p.name}
                                      </button>
                                      <span>
                                        PT-{String(p.id).padStart(4, "0")}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <div className="contact-cell">
                                    <span>{p.email}</span>
                                    <small>{p.phone}</small>
                                  </div>
                                </td>
                                <td>
                                  {p.gender}
                                  <span className="subtext">
                                    {Number.isNaN(age)
                                      ? "Date of birth not provided"
                                      : `${age} years old`}
                                  </span>
                                </td>
                                <td>
                                  <span className="blood-group">
                                    {p.bloodGroup || "Unknown"}
                                  </span>
                                </td>
                                <td>
                                  {
                                    appointments.filter(
                                      (a) => a.patientId === p.id,
                                    ).length
                                  }{" "}
                                  visits
                                </td>
                                <td>
                                  <div className="row-actions">
                                    <button
                                      className="icon-button"
                                      aria-label={`Edit ${p.name}`}
                                      onClick={() =>
                                        setForm({
                                          entity: "patients",
                                          record: p,
                                        })
                                      }
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      className="icon-button danger"
                                      aria-label={`Delete ${p.name}`}
                                      onClick={() =>
                                        confirmDelete("patients", p.id, p.name)
                                      }
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title="No patients found"
                      description="Try a different search, or add your first patient."
                    />
                  )}
                  <div className="list-footer">
                    Showing {filteredPatients.length} of {patients.length}{" "}
                    patients
                  </div>
                </section>
              ) : section === "Doctors" ? (
                <>
                  <div className="directory-toolbar doctors-toolbar">
                    <span className="muted">
                      {filteredDoctors.length} doctors caring for your community
                    </span>
                    <label className="filter-select">
                      <Stethoscope size={16} />
                      <select
                        aria-label="Filter doctors by specialty"
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                      >
                        <option>All specialties</option>
                        {specialties.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="doctors-grid">
                    {filteredDoctors.map((d) => (
                      <article className="doctor-card panel" key={d.id}>
                        <div className={`doctor-cover ${d.color}`}>
                          <span className="cover-plus">+</span>
                          <Stethoscope size={54} strokeWidth={1} />
                          <div className="doctor-card-actions">
                            <button
                              className="icon-button"
                              aria-label={`Edit ${d.name}`}
                              onClick={() =>
                                setForm({ entity: "doctors", record: d })
                              }
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              className="icon-button danger"
                              aria-label={`Delete ${d.name}`}
                              onClick={() =>
                                confirmDelete("doctors", d.id, d.name)
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="doctor-info">
                          <Avatar name={d.name} color={d.color} size="large" />
                          <span className="doctor-specialty">
                            {d.specialty}
                          </span>
                          <h2>{d.name}</h2>
                          <p className="muted">Care that feels personal.</p>
                          <div className="doctor-contacts">
                            <a href={`mailto:${d.email}`}>
                              <Mail size={15} />
                              {d.email}
                            </a>
                            <a href={`tel:${d.phone}`}>
                              <Phone size={15} />
                              {d.phone}
                            </a>
                          </div>
                          <div className="doctor-stats">
                            <span>
                              <strong>
                                {
                                  new Set(
                                    appointments
                                      .filter((a) => a.doctorId === d.id)
                                      .map((a) => a.patientId),
                                  ).size
                                }
                              </strong>
                              Patients
                            </span>
                            <span>
                              <strong>
                                {
                                  appointments.filter(
                                    (a) =>
                                      a.doctorId === d.id && a.date === today,
                                  ).length
                                }
                              </strong>
                              Visits today
                            </span>
                          </div>
                          <button
                            className="button secondary full-width"
                            onClick={() =>
                              setForm({
                                entity: "appointments",
                                record: { doctorId: d.id },
                              })
                            }
                          >
                            <CalendarPlus size={16} />
                            Book appointment
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!filteredDoctors.length && (
                    <Empty
                      title="No doctors found"
                      description="Try a different specialty, or add a doctor to your team."
                    />
                  )}
                </>
              ) : (
                <section className="panel directory-panel">
                  <div className="directory-toolbar">
                    <div>
                      <h2>
                        All appointments{" "}
                        <span className="count-pill">
                          {filteredAppointments.length}
                        </span>
                      </h2>
                      <p>Keeping your day in good hands.</p>
                    </div>
                    <div className="appointment-filters">
                      <label className="filter-select">
                        <CalendarDays size={15} />
                        <input
                          aria-label="Filter appointments by date"
                          type="date"
                          value={appointmentDay}
                          onChange={(e) => setAppointmentDay(e.target.value)}
                        />
                        {appointmentDay && (
                          <button
                            className="icon-button"
                            aria-label="Clear date filter"
                            onClick={() => setAppointmentDay("")}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </label>
                      <select
                        aria-label="Filter appointments by status"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        {[
                          "All statuses",
                          "Scheduled",
                          "Confirmed",
                          "Completed",
                          "Cancelled",
                        ].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {appointmentTable(filteredAppointments)}
                  <div className="list-footer">
                    Showing {filteredAppointments.length} of{" "}
                    {appointments.length} appointments
                  </div>
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>Thoughtfully connected. Better together.</span>
            <span>
              <span className="footer-logo">
                <Plus size={12} />
              </span>{" "}
              Made for a little more care.
            </span>
          </footer>
        </main>
      </div>
      {form && (
        <RecordForm
          {...form}
          patients={patients}
          doctors={doctors}
          onClose={() => setForm(null)}
          onSaved={saved}
        />
      )}
      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <section
            className="modal patient-detail"
            role="dialog"
            aria-modal="true"
            aria-label="Patient details"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button detail-close"
              aria-label="Close patient details"
              onClick={() => setDetail(null)}
            >
              <X size={20} />
            </button>
            <Avatar name={detail.name} size="large" />
            <span className="eyebrow">
              PATIENT RECORD · PT-{String(detail.id).padStart(4, "0")}
            </span>
            <h2>{detail.name}</h2>
            <div className="detail-tags">
              <span>{detail.gender}</span>
              <span>Blood group: {detail.bloodGroup}</span>
            </div>
            <div className="detail-grid">
              <div>
                <label>Email</label>
                <a href={`mailto:${detail.email}`}>{detail.email}</a>
              </div>
              <div>
                <label>Phone</label>
                <a href={`tel:${detail.phone}`}>{detail.phone}</a>
              </div>
              <div>
                <label>Date of birth</label>
                <span>
                  {detail.dateOfBirth
                    ? localDate(detail.dateOfBirth).toLocaleDateString(
                        "en-US",
                        { dateStyle: "medium" },
                      )
                    : "Not provided"}
                </span>
              </div>
              <div>
                <label>Address</label>
                <span>{detail.address || "Not provided"}</span>
              </div>
            </div>
            <div className="clinical-note">
              <h4>Clinical notes</h4>
              <p>{detail.notes || "No clinical notes recorded."}</p>
            </div>
            <h4 className="history-title">Visit history</h4>
            <div className="visit-history">
              {appointments
                .filter((a) => a.patientId === detail.id)
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((a) => (
                  <div className="visit-item" key={a.id}>
                    <span className="visit-date">
                      {displayDate(a.date)}
                      <small>{displayTime(a.time)}</small>
                    </span>
                    <div>
                      <strong>{a.reason}</strong>
                      <span>{a.doctorName}</span>
                    </div>
                    <Badge status={a.status} />
                  </div>
                ))}
              {!appointments.some((a) => a.patientId === detail.id) && (
                <p className="muted">
                  No visits yet. Their care journey starts here.
                </p>
              )}
            </div>
            <div className="form-actions">
              <button
                className="button secondary"
                onClick={() => {
                  setForm({ entity: "patients", record: detail });
                  setDetail(null);
                }}
              >
                <Pencil size={15} />
                Edit patient
              </button>
              <button
                className="button primary"
                onClick={() => {
                  setForm({
                    entity: "appointments",
                    record: { patientId: detail.id },
                  });
                  setDetail(null);
                }}
              >
                <Plus size={16} />
                Book visit
              </button>
            </div>
          </section>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="modal help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <span className="modal-icon">
                <Heart size={23} />
              </span>
              <button
                className="icon-button"
                aria-label="Close help"
                onClick={() => setHelp(false)}
              >
                <X size={20} />
              </button>
            </div>
            <h2 id="help-title">Welcome to your calmer workday.</h2>
            <p className="muted">
              A few simple steps to keep your clinic connected.
            </p>
            {[
              {
                title: "Meet your patients",
                text: "Add patient details, keep clinical notes, and see their complete visit history.",
                icon: Users,
              },
              {
                title: "Build your care team",
                text: "Add doctors and their specialties. Find the right person for every visit.",
                icon: Stethoscope,
              },
              {
                title: "Make time for care",
                text: "Book an appointment, confirm a visit, or mark it complete. Scheduling conflicts are checked automatically.",
                icon: CalendarDays,
              },
            ].map(({ title, text, icon: Icon }) => (
              <div className="help-step" key={title}>
                <Icon size={21} />
                <div>
                  <h4>{title}</h4>
                  <p>{text}</p>
                </div>
              </div>
            ))}
            <div className="demo-notice">
              Development workspace · Sample records are fictional.
              Authentication and production security must be configured before
              storing real patient data.
            </div>
            <button
              className="button primary full-width"
              onClick={() => setHelp(false)}
            >
              Let’s get started <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
      {removing && (
        <div
          className="modal-backdrop"
          onClick={() => !busy && setRemoving(null)}
        >
          <section
            className="modal confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-icon">
              <Trash2 size={24} />
            </div>
            <h2 id="delete-title">Delete {removing.name}?</h2>
            <p className="muted">
              This removes the record permanently. Patient and doctor records
              with appointment history are protected from deletion.
            </p>
            {deleteError && (
              <div className="form-error" role="alert">
                {deleteError}
              </div>
            )}
            <div className="form-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setRemoving(null)}
              >
                Keep record
              </button>
              <button
                className="button destructive"
                disabled={busy}
                onClick={() => void remove()}
              >
                {busy ? "Deleting…" : "Delete record"}
              </button>
            </div>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
