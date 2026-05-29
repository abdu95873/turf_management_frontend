import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FiChevronDown,
  FiChevronUp,
  FiCloud,
  FiMapPin,
  FiMoon,
  FiSun,
} from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { api, authHeaders } from "../../lib/api";
import {
  buildVisitDates,
  formatPeriodRange,
  getSlotSubLabel,
  groupSlotsByPeriod,
  SLOT_PERIODS,
} from "../../lib/slotPeriods";
import { formatTime12h, getTodayDate } from "../../lib/slotTime";
import {
  Alert,
  DashboardCard,
  EmptyState,
  Field,
  Select,
} from "../../pages/dashboard/shared/PageChrome";
import "../../styles/slot-checking.css";

const PERIOD_ICONS = {
  sun: FiSun,
  cloud: FiCloud,
  sunset: FiSun,
  moon: FiMoon,
};

function statusClass(status) {
  if (status === "booked") return "is-booked";
  if (status === "blocked") return "is-blocked";
  return "is-available";
}

export default function SlotCheckingPanel() {
  const { token } = useAuth();
  const today = getTodayDate();
  const visitDates = useMemo(() => buildVisitDates(14, today), [today]);

  const [resourceId, setResourceId] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [collapsed, setCollapsed] = useState({});

  const resourcesQuery = useQuery({
    queryKey: ["slot-checking-resources"],
    queryFn: () =>
      api("/api/bookings/manage/resources", {
        headers: authHeaders(token),
      }),
  });

  const resources = resourcesQuery.data ?? [];
  const selectedResource = resources.find((item) => item._id === resourceId) ?? null;
  const basePrice = selectedResource?.pricePerHour ?? 0;

  const slotsQuery = useQuery({
    queryKey: ["slot-checking-slots", resourceId, selectedDate],
    enabled: Boolean(resourceId && selectedDate),
    queryFn: () => api(`/api/slots?resourceId=${resourceId}&date=${selectedDate}`),
  });

  const slots = slotsQuery.data ?? [];
  const grouped = useMemo(() => groupSlotsByPeriod(slots), [slots]);
  const selectedSlot = slots.find((item) => item._id === selectedSlotId) ?? null;

  const summary = useMemo(() => {
    const available = slots.filter((s) => s.status === "available").length;
    const booked = slots.filter((s) => s.status === "booked").length;
    const blocked = slots.filter((s) => s.status === "blocked").length;
    return { total: slots.length, available, booked, blocked };
  }, [slots]);

  useEffect(() => {
    if (!resourceId && resources.length) {
      setResourceId(resources[0]._id);
    }
  }, [resources, resourceId]);

  useEffect(() => {
    setSelectedSlotId("");
  }, [resourceId, selectedDate]);

  function togglePeriod(key) {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="slot-checking">
      <DashboardCard className="slot-checking-card">
        <div className="slot-checking-venue">
          <Field label="Select venue" htmlFor="slot-checking-venue">
            <Select
              id="slot-checking-venue"
              value={resourceId}
              onChange={(event) => setResourceId(event.target.value)}
              disabled={resourcesQuery.isLoading}
            >
              <option value="">
                {resourcesQuery.isLoading ? "Loading venues…" : "Choose a venue"}
              </option>
              {resources.map((resource) => (
                <option key={resource._id} value={resource._id}>
                  {resource.name}
                  {resource.locationName ? ` — ${resource.locationName}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          {selectedResource ? (
            <p className="slot-checking-venue-meta">
              <FiMapPin aria-hidden="true" />
              {selectedResource.locationName || "No location set"}
              {basePrice > 0 ? ` · ${basePrice} BDT/h base` : ""}
            </p>
          ) : null}
        </div>

        {!resourceId ? (
          <EmptyState
            title="Select a venue"
            description="Choose a venue above to view slot availability by date and time."
          />
        ) : (
          <>
            <section className="slot-checking-dates" aria-label="Visit date">
              <h3 className="slot-checking-section-title">When are you visiting?</h3>
              <div className="slot-checking-date-scroll">
                {visitDates.map((item) => {
                  const isActive = item.iso === selectedDate;
                  return (
                    <button
                      key={item.iso}
                      type="button"
                      className={`slot-checking-date-card ${isActive ? "is-active" : ""}`}
                      onClick={() => setSelectedDate(item.iso)}
                    >
                      <span className="slot-checking-date-day">{item.dayLabel}</span>
                      <span className="slot-checking-date-num">{item.dateLabel}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="slot-checking-times" aria-label="Time slots">
              <div className="slot-checking-times-head">
                <h3 className="slot-checking-section-title">Select the time of day to see availability</h3>
                {!slotsQuery.isLoading && slots.length > 0 ? (
                  <p className="slot-checking-summary">
                    {summary.available} open · {summary.booked} booked · {summary.blocked} blocked
                  </p>
                ) : null}
              </div>

              {slotsQuery.isLoading ? (
                <p className="slot-checking-loading">Loading slots…</p>
              ) : slotsQuery.isError ? (
                <Alert tone="danger">Could not load slots. Try another date or venue.</Alert>
              ) : slots.length === 0 ? (
                <EmptyState
                  title="No slots for this day"
                  description="Generate slots in Venue Management or pick another date."
                />
              ) : (
                <div className="slot-checking-periods">
                  {SLOT_PERIODS.map((period) => {
                    const periodSlots = grouped[period.key] ?? [];
                    if (!periodSlots.length) return null;

                    const Icon = PERIOD_ICONS[period.icon] ?? FiSun;
                    const isOpen = !collapsed[period.key];
                    const rangeLabel = formatPeriodRange(periodSlots, period.defaultRange);

                    return (
                      <article key={period.key} className="slot-checking-period">
                        <button
                          type="button"
                          className="slot-checking-period-head"
                          onClick={() => togglePeriod(period.key)}
                          aria-expanded={isOpen}
                        >
                          <span className="slot-checking-period-icon" aria-hidden="true">
                            <Icon />
                          </span>
                          <span className="slot-checking-period-text">
                            <strong>{period.label}</strong>
                            <span>{rangeLabel}</span>
                          </span>
                          <span className="slot-checking-period-toggle" aria-hidden="true">
                            {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                          </span>
                        </button>

                        {isOpen ? (
                          <div className="slot-checking-slot-grid">
                            {periodSlots.map((slot) => {
                              const isSelected = slot._id === selectedSlotId;
                              const sub = getSlotSubLabel(slot, basePrice);
                              const isSelectable = slot.status === "available";

                              return (
                                <button
                                  key={slot._id}
                                  type="button"
                                  disabled={!isSelectable}
                                  className={[
                                    "slot-checking-slot-btn",
                                    statusClass(slot.status),
                                    isSelected ? "is-selected" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  onClick={() => setSelectedSlotId(slot._id)}
                                >
                                  <span className="slot-checking-slot-time">
                                    {formatTime12h(slot.startTime)}
                                  </span>
                                  {sub ? <span className="slot-checking-slot-sub">{sub}</span> : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {selectedSlot ? (
              <aside className="slot-checking-selection" aria-live="polite">
                <p className="slot-checking-selection-label">Selected slot</p>
                <p className="slot-checking-selection-value">
                  {formatTime12h(selectedSlot.startTime)}
                  {selectedSlot.endTime ? ` – ${formatTime12h(selectedSlot.endTime)}` : ""}
                </p>
                <p className="slot-checking-selection-meta">
                  {selectedDate} · {selectedSlot.status}
                  {selectedSlot.pricePerHour != null ? ` · ${selectedSlot.pricePerHour} BDT/h` : ""}
                </p>
              </aside>
            ) : null}
          </>
        )}
      </DashboardCard>
    </div>
  );
}
