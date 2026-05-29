import { formatTime12h, toMinutes } from "./slotTime";

export const SLOT_PERIODS = [
  {
    key: "morning",
    label: "Morning",
    icon: "sun",
    defaultRange: "06:00 AM – 11:30 AM",
    match: (mins) => mins < 720,
  },
  {
    key: "afternoon",
    label: "Afternoon",
    icon: "cloud",
    defaultRange: "12:00 PM – 04:30 PM",
    match: (mins) => mins >= 720 && mins < 1020,
  },
  {
    key: "evening",
    label: "Evening",
    icon: "sunset",
    defaultRange: "05:00 PM – 08:30 PM",
    match: (mins) => mins >= 1020 && mins < 1260,
  },
  {
    key: "night",
    label: "Night",
    icon: "moon",
    defaultRange: "09:00 PM – 01:00 AM",
    match: (mins) => mins >= 1260,
  },
];

export function getSlotPeriodKey(startTime) {
  const mins = toMinutes(startTime);
  const period = SLOT_PERIODS.find((item) => item.match(mins));
  return period?.key ?? "morning";
}

export function groupSlotsByPeriod(slots) {
  const groups = Object.fromEntries(SLOT_PERIODS.map((period) => [period.key, []]));
  (slots ?? []).forEach((slot) => {
    const key = getSlotPeriodKey(slot.startTime);
    groups[key].push(slot);
  });
  SLOT_PERIODS.forEach((period) => {
    groups[period.key].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  });
  return groups;
}

export function formatPeriodRange(slots, fallback) {
  if (!slots?.length) return fallback;
  const first = slots[0];
  const last = slots[slots.length - 1];
  const end = last.endTime || last.startTime;
  return `${formatTime12h(first.startTime)} to ${formatTime12h(end)}`;
}

function addDaysIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function buildVisitDates(count = 14, startIso) {
  const items = [];
  for (let i = 0; i < count; i += 1) {
    const iso = addDaysIso(startIso, i);
    const date = new Date(`${iso}T12:00:00`);
    const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
    const dayLabel = i === 0 ? "Today" : i === 1 ? "Tomorrow" : weekday;
    const dateLabel = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    items.push({ iso, dayLabel, dateLabel });
  }
  return items;
}

export function getSlotSubLabel(slot, basePrice) {
  const slotPrice = slot.pricePerHour;
  if (basePrice > 0 && slotPrice != null && slotPrice < basePrice) {
    const pct = Math.round((1 - slotPrice / basePrice) * 100);
    if (pct > 0) return `${pct}% off`;
  }
  if (slot.status === "booked") return "Booked";
  if (slot.status === "blocked") return "Blocked";
  if (slot.status === "available") return "Available";
  return "";
}
