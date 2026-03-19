import { useEffect, useMemo, useState } from "react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function formatSchedulePreview(date: Date): string {
  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getLocalTzLabel(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const sample = new Date().toLocaleTimeString([], { timeZoneName: "long" });
  const parts = sample.split(" ");
  const label = parts.slice(2).join(" ");
  return label || tz;
}

export default function SchedulePickerModal({
  initialISO,
  onClose,
  onConfirm,
}: {
  initialISO: string | null;
  onClose: () => void;
  onConfirm: (localDateTimeIsoNoSeconds: string) => void;
}) {
  const initialDate = useMemo(() => {
    if (initialISO) {
      const parsed = new Date(initialISO);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const d = new Date(Date.now() + 10 * 60 * 1000);
    d.setSeconds(0, 0);
    return d;
  }, [initialISO]);

  const [year, setYear] = useState(initialDate.getFullYear());
  const [month, setMonth] = useState(initialDate.getMonth());
  const [day, setDay] = useState(initialDate.getDate());
  const [hour, setHour] = useState(initialDate.getHours());
  const [minute, setMinute] = useState(initialDate.getMinutes());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const maxDay = daysInMonth(year, month);
  const clampedDay = Math.min(day, maxDay);
  const candidate = new Date(year, month, clampedDay, hour, minute, 0, 0);

  const minAllowed = useMemo(() => {
    const d = new Date(Date.now() + 60 * 1000);
    d.setSeconds(0, 0);
    return d;
  }, []);

  const isPast = candidate.getTime() < minAllowed.getTime();

  const years = Array.from({ length: 7 }, (_, idx) => new Date().getFullYear() + idx);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "rgba(2, 6, 14, 0.74)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        animation: "quoteOverlayIn 0.18s ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(920px, 100%)",
          borderRadius: 20,
          border: "1px solid var(--color-border)",
          background: "#05080f",
          color: "var(--color-cream)",
          boxShadow: "0 20px 80px rgba(0,0,0,0.45)",
          animation: "quotePanelIn 0.18s ease both",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px" }}>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: "var(--color-cream)", fontSize: 34, lineHeight: 1 }}>
            ×
          </button>
          <h2 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 44, lineHeight: 1 }}>Schedule</h2>
          <button
            onClick={() => {
              const localIso = `${year}-${String(month + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
              onConfirm(localIso);
            }}
            disabled={isPast}
            style={{
              border: "none",
              borderRadius: 999,
              background: isPast ? "#7f8a9c" : "#dce1e8",
              color: "#141a23",
              fontWeight: 700,
              fontFamily: "var(--font-sans)",
              fontSize: 20,
              padding: "10px 22px",
              opacity: isPast ? 0.55 : 1,
            }}
          >
            Confirm
          </button>
        </div>

        <div style={{ padding: "0 20px 22px" }}>
          <div style={{ color: "#8d96a4", fontFamily: "var(--font-sans)", fontSize: 22, marginBottom: 20 }}>
            Will send on {formatSchedulePreview(candidate)}
          </div>

          <section style={{ marginBottom: 20 }}>
            <div style={{ color: "#8d96a4", fontSize: 18, marginBottom: 8 }}>Date</div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
              <Picker label="Month" value={month} onChange={(v) => setMonth(Number(v))}>
                {MONTHS.map((name, idx) => (
                  <option key={name} value={idx}>{name}</option>
                ))}
              </Picker>
              <Picker label="Day" value={clampedDay} onChange={(v) => setDay(Number(v))}>
                {Array.from({ length: maxDay }, (_, idx) => idx + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Picker>
              <Picker label="Year" value={year} onChange={(v) => setYear(Number(v))}>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Picker>
            </div>
          </section>

          <section style={{ marginBottom: 20 }}>
            <div style={{ color: "#8d96a4", fontSize: 18, marginBottom: 8 }}>Time</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Picker label="Hour" value={hour} onChange={(v) => setHour(Number(v))}>
                {Array.from({ length: 24 }, (_, idx) => idx).map((h) => (
                  <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
                ))}
              </Picker>
              <Picker label="Minute" value={minute} onChange={(v) => setMinute(Number(v))}>
                {Array.from({ length: 60 }, (_, idx) => idx).map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                ))}
              </Picker>
            </div>
          </section>

          <section>
            <div style={{ color: "#8d96a4", fontSize: 18 }}>Time zone</div>
            <div style={{ fontSize: 24, marginTop: 4 }}>{getLocalTzLabel()}</div>
          </section>

          {isPast && (
            <div style={{ marginTop: 14, color: "var(--color-danger)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
              Please pick a future time (at least 1 minute from now).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Picker({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        border: "1px solid #232a39",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <span style={{ color: "#8d96a4", fontSize: 12 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: "none",
          outline: "none",
          background: "transparent",
          color: "var(--color-cream)",
          fontSize: 20,
          fontFamily: "var(--font-sans)",
        }}
      >
        {children}
      </select>
    </label>
  );
}
