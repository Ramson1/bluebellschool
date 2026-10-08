// Date helpers shared by attendance queries.

// Real last calendar day of a "YYYY-MM" month, as a "YYYY-MM-DD" string.
// Never hard-code "-31": Postgres rejects out-of-range dates like "2026-09-31"
// with `date/time field value out of range`.
export function endOfMonth(ym) {
  const [y, m] = (ym || "").split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return `${ym}-31`; // best-effort; callers guard input
  const last = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this month
  return `${ym}-${String(last).padStart(2, "0")}`;
}
