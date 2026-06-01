import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { FiChevronDown, FiLayers, FiMapPin, FiSearch, FiX } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { getVenuePath } from "../../../lib/venueUrls";
import { useAuth } from "../../../context/AuthContext";
import useNowTicker from "../../../hooks/useNowTicker";
import { api, authHeaders, getBookingAuthMessage } from "../../../lib/api";
import { DEFAULT_ONLINE_PAYMENT_PROVIDER } from "../../../lib/payments";
import { buildVisitDates } from "../../../lib/slotPeriods";
import { filterFutureSlots, formatTime12h, getTodayDate, isSlotPast } from "../../../lib/slotTime";
import {
  buildCategoriesFromResources,
  CATEGORY_META,
  matchesCategory,
} from "../../discover/categoryMeta";
import { DsFieldLabel, DsInput, DsSelect, HomeSectionHeading } from "../shared/HomeUi";
import "./booking-search.css";

const FALLBACK_CATEGORIES = Object.entries(CATEGORY_META).map(([key, meta]) => ({
  key,
  title: meta.title,
  icon: meta.icon,
  subtitle: meta.subtitle,
  count: 0,
}));

const MAX_VISIBLE = 9;
const FORMAT_OPTIONS = ["5-a-side", "7-a-side", "11-a-side"];
/** Side panel only at xl+; below that = expandable venue cards (sm/md/lg) */
const DESKTOP_BOOKING_MQ = "(min-width: 1280px)";

function useMinWidth(mediaQuery) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(mediaQuery).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(mediaQuery);
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [mediaQuery]);

  return matches;
}

function getSurfaceLabel(type) {
  if (type === "turf") return "Artificial Turf";
  if (type === "pool") return "Aquatic";
  return "Hybrid Grass";
}

function matchesAreaSearch(resource, query) {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const location = (resource.locationName || "").toLowerCase();
  const name = (resource.name || "").toLowerCase();
  return location.includes(term) || name.includes(term);
}

function getEmptyVenueMessage({ selectedCategoryKey, areaSearch }) {
  const area = areaSearch.trim();
  if (area && selectedCategoryKey) {
    return `No venues in "${area}" for this sport. Try another area or category.`;
  }
  if (area) {
    return `No venues in "${area}". Try another city or area.`;
  }
  if (selectedCategoryKey) {
    return "No venues in this category yet. Try another sport or view all.";
  }
  return "Venues will appear once companies are added to the platform.";
}

function VenueAreaSearch({ value, onChange, suggestions }) {
  const listId = "booking-area-suggestions";

  return (
    <div className="booking-area-search-wrap">
      <label htmlFor="booking-area-search" className="sr-only">
        Search by city or area
      </label>
      <FiSearch className="booking-area-search-icon" aria-hidden="true" />
      <input
        id="booking-area-search"
        type="search"
        className="booking-area-search-input"
        placeholder="Search by city or area (e.g. Gulshan, Dhaka)…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        list={suggestions.length ? listId : undefined}
        autoComplete="off"
      />
      {suggestions.length ? (
        <datalist id={listId}>
          {suggestions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      ) : null}
      {value.trim() ? (
        <button
          type="button"
          className="booking-area-search-clear"
          aria-label="Clear area search"
          onClick={() => onChange("")}
        >
          <FiX aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function getVenueStatus(slots, date, isLoading) {
  if (isLoading) return { label: "Checking…", available: false };
  const futureSlots = filterFutureSlots(slots, date);
  const available = futureSlots.filter((slot) => slot.status === "available");
  if (available.length) return { label: "Available", available: true };
  const booked = futureSlots.find((slot) => slot.status === "booked");
  return {
    label: booked?.startTime ? `Busy ${formatTime12h(booked.startTime)}` : "Busy",
    available: false,
  };
}

function VenueCategoryBar({ categories, selectedKey, onSelect }) {
  return (
    <div className="booking-category-scroll" role="tablist" aria-label="Sport category">
      <button
        type="button"
        role="tab"
        aria-selected={!selectedKey}
        className={`booking-category-chip ${!selectedKey ? "is-active" : ""}`}
        onClick={() => onSelect("")}
      >
        <span>All sports</span>
        <span className="booking-category-count">
          {categories.reduce((sum, item) => sum + (item.count || 0), 0)}
        </span>
      </button>
      {categories.map((category) => {
        const isActive = selectedKey === category.key;
        return (
          <button
            key={category.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`booking-category-chip ${isActive ? "is-active" : ""}`}
            onClick={() => onSelect(category.key)}
          >
            <span className="booking-category-icon" aria-hidden="true">
              {category.icon}
            </span>
            <span>{category.title}</span>
            {category.count > 0 ? (
              <span className="booking-category-count">{category.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function DateStrip({ dates, selectedDate, onSelect }) {
  return (
    <div className="booking-date-scroll" role="listbox" aria-label="Visit date">
      {dates.map((item) => {
        const isActive = item.iso === selectedDate;
        return (
          <button
            key={item.iso}
            type="button"
            role="option"
            aria-selected={isActive}
            className={`booking-date-card ${isActive ? "is-active" : ""}`}
            onClick={() => onSelect(item.iso)}
          >
            <span className="day">{item.dayLabel}</span>
            <span className="num">{item.dateLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

function SlotGrid({ slots, selectedSlotId, onSelect, isLoading }) {
  if (isLoading) {
    return <p className="text-sm text-ds-muted">Loading slots…</p>;
  }
  if (!slots.length) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-ds-muted">
        No slots available for this date.
      </p>
    );
  }

  return (
    <div className="booking-slot-grid">
      {slots.map((slot) => {
        const isAvailable = slot.status === "available";
        const isSelected = selectedSlotId === slot._id;
        return (
          <button
            key={slot._id}
            type="button"
            disabled={!isAvailable}
            className={[
              "booking-slot-btn m-0 w-auto min-h-0",
              isAvailable ? "is-available" : "is-busy",
              isSelected ? "is-selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => isAvailable && onSelect(slot._id)}
          >
            {formatTime12h(slot.startTime)}
          </button>
        );
      })}
    </div>
  );
}

function VenueCardHead({ resource, status, isExpanded, onToggle }) {
  return (
    <button
      type="button"
      className="booking-venue-card-head"
      onClick={onToggle}
      aria-expanded={isExpanded}
    >
      <span
        className={`absolute right-4 top-4 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase ${
          status.available ? "bg-ds-accent text-ds-dark" : "bg-red-500 text-white"
        }`}
      >
        {status.label}
      </span>
      <p className="mb-0.5 text-[10px] font-semibold uppercase text-ds-muted">Today</p>
      <h3 className="pr-20 text-lg font-extrabold uppercase tracking-wide text-ds-secondary">
        {resource.name}
      </h3>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ds-muted">
        <span className="inline-flex items-center gap-1.5">
          <FiMapPin className="shrink-0 text-ds-primary" />
          {resource.locationName}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FiLayers className="shrink-0 text-ds-primary" />
          {getSurfaceLabel((resource.type || "").toLowerCase())}
        </span>
      </div>
      <FiChevronDown
        className={`absolute bottom-4 right-4 text-lg text-slate-400 transition-transform duration-200 ${
          isExpanded ? "rotate-180 text-ds-primary" : ""
        }`}
        aria-hidden="true"
      />
    </button>
  );
}

function VenueBookingSteps({
  visitDates,
  selectedDate,
  onDateSelect,
  slotGrid,
  guestFields,
  selectedFormat,
  packages,
  onFormatChange,
  bookingSummary,
  bookingTotal,
  feedback,
  onConfirm,
  confirmDisabled,
  confirmPending,
  onViewVenue,
  compactConfirm = false,
}) {
  return (
    <>
      <div className="booking-step-block">
        <p className="booking-step-label">When are you visiting?</p>
        <DateStrip dates={visitDates} selectedDate={selectedDate} onSelect={onDateSelect} />
      </div>

      <div className="booking-step-block">
        <p className="booking-step-label">Select time slot</p>
        {slotGrid}
      </div>

      <details className="booking-more-options booking-step-block">
        <summary className="flex items-center gap-1">
          More options <FiChevronDown className="text-sm" />
        </summary>
        <label className="mt-3 block">
          <DsFieldLabel>Format / package</DsFieldLabel>
          <DsSelect value={selectedFormat} onChange={onFormatChange}>
            {FORMAT_OPTIONS.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
            {packages.map((pkg) => (
              <option key={pkg._id} value={pkg.name}>
                {pkg.name}
              </option>
            ))}
          </DsSelect>
        </label>
      </details>

      <div className="booking-step-block rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="booking-step-label mb-3">Your details</p>
        {guestFields}
      </div>

      <div className="booking-step-block">
        <div className="flex items-center justify-between rounded-xl bg-[#eef2ee] px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-ds-muted">Booking total</p>
            <p className="mt-1 truncate text-sm text-ds-secondary">{bookingSummary}</p>
          </div>
          <p className="shrink-0 text-2xl font-extrabold text-ds-secondary">{bookingTotal} BDT</p>
        </div>
        {feedback ? <p className="mt-3 text-sm text-red-600">{feedback}</p> : null}
        {!compactConfirm ? (
          <>
            <button
              type="button"
              className="mt-4 m-0 w-full min-h-0 rounded-xl bg-ds-accent py-3.5 text-sm font-bold uppercase tracking-wide text-ds-dark transition hover:bg-[#b8ef1a] disabled:opacity-60"
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmPending ? "Processing…" : "Confirm Booking"}
            </button>
            <button
              type="button"
              className="mt-3 m-0 w-full min-h-0 bg-transparent text-center text-xs font-semibold uppercase tracking-wide text-ds-primary hover:underline"
              onClick={onViewVenue}
            >
              View full venue page
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}

export default function BookingSearchSection({ resources = [] }) {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const nowTick = useNowTicker();
  const today = getTodayDate();
  const visitDates = useMemo(() => buildVisitDates(14, today), [today]);

  const [showAll, setShowAll] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedFormat, setSelectedFormat] = useState(FORMAT_OPTIONS[0]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [feedback, setFeedback] = useState("");
  const [selectedCategoryKey, setSelectedCategoryKey] = useState("");
  const [areaSearch, setAreaSearch] = useState("");

  const areaSuggestions = useMemo(() => {
    const values = new Set();
    resources.forEach((resource) => {
      const location = resource.locationName?.trim();
      if (!location) return;
      values.add(location);
      location.split(/[,|]/).forEach((part) => {
        const piece = part.trim();
        if (piece) values.add(piece);
      });
    });
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [resources]);

  const resourcesInArea = useMemo(
    () => resources.filter((resource) => matchesAreaSearch(resource, areaSearch)),
    [resources, areaSearch]
  );

  const categories = useMemo(() => {
    const built = buildCategoriesFromResources(resourcesInArea);
    return built.length ? built : FALLBACK_CATEGORIES;
  }, [resourcesInArea]);

  const filteredResources = useMemo(() => {
    let list = resourcesInArea;
    if (selectedCategoryKey) {
      list = list.filter((resource) => matchesCategory(resource, selectedCategoryKey));
    }
    return list;
  }, [resourcesInArea, selectedCategoryKey]);

  const emptyVenueMessage = getEmptyVenueMessage({ selectedCategoryKey, areaSearch });

  const visibleResources = showAll ? filteredResources : filteredResources.slice(0, MAX_VISIBLE);
  const hasMore = filteredResources.length > MAX_VISIBLE;
  const selectedResource = filteredResources.find((resource) => resource._id === selectedResourceId) ?? null;
  const isDesktopBooking = useMinWidth(DESKTOP_BOOKING_MQ);

  useEffect(() => {
    setShowAll(false);
    setSelectedSlotId("");
    setFeedback("");
    if (!isDesktopBooking) {
      setSelectedResourceId("");
    }
  }, [selectedCategoryKey, areaSearch, isDesktopBooking]);

  useEffect(() => {
    if (!isDesktopBooking) return;
    if (!filteredResources.length) {
      setSelectedResourceId("");
      return;
    }
    const stillInList = filteredResources.some((resource) => resource._id === selectedResourceId);
    if (!stillInList) {
      setSelectedResourceId(filteredResources[0]._id);
    }
  }, [isDesktopBooking, filteredResources, selectedResourceId]);

  useEffect(() => {
    if (user?.name && !guestName) {
      setGuestName(user.name);
    }
  }, [user?.name, guestName]);

  const slotPreviews = useQueries({
    queries: visibleResources.map((resource) => ({
      queryKey: ["booking-preview", resource._id, today],
      queryFn: () => api(`/api/slots?resourceId=${resource._id}&date=${today}`),
      enabled: Boolean(resource._id),
      staleTime: 60_000,
    })),
  });

  const packagesQuery = useQuery({
    queryKey: ["booking-packages", selectedResourceId],
    enabled: Boolean(selectedResourceId),
    queryFn: () => api(`/api/packages?resourceId=${selectedResourceId}`),
  });

  const slotsQuery = useQuery({
    queryKey: ["booking-slots", selectedResourceId, selectedDate],
    enabled: Boolean(selectedResourceId && selectedDate),
    queryFn: () => api(`/api/slots?resourceId=${selectedResourceId}&date=${selectedDate}`),
  });

  const packages = packagesQuery.data ?? [];
  const allSlots = slotsQuery.data ?? [];
  const bookableSlots = useMemo(
    () => filterFutureSlots(allSlots, selectedDate),
    [allSlots, selectedDate, nowTick]
  );
  const selectedPackage = packages.find((pkg) => pkg._id === selectedPackageId) ?? null;
  const selectedSlot = bookableSlots.find((slot) => slot._id === selectedSlotId) ?? null;

  useEffect(() => {
    if (selectedSlotId && isSlotPast(selectedDate, selectedSlot?.startTime)) {
      setSelectedSlotId("");
    }
  }, [selectedSlotId, selectedDate, selectedSlot?.startTime, nowTick]);

  const bookingTotal = useMemo(() => {
    if (selectedPackage) return selectedPackage.pricePerSlot;
    if (selectedResource) return selectedResource.pricePerHour ?? 0;
    return 0;
  }, [selectedPackage, selectedResource]);

  const bookMutation = useMutation({
    mutationFn: async () => {
      const booking = await api("/api/bookings", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          slotId: selectedSlotId,
          idempotencyKey: `${selectedSlotId}-${Date.now()}`,
        }),
      });

      const payment = await api("/api/payments/initiate", {
        method: "POST",
        headers: {
          ...authHeaders(token),
          "x-idempotency-key": `sslcommerz-${booking._id}-${Date.now()}`,
        },
        body: JSON.stringify({
          bookingId: booking._id,
          provider: DEFAULT_ONLINE_PAYMENT_PROVIDER,
        }),
      });

      return payment;
    },
    onSuccess: (payment) => {
      setFeedback("Booking confirmed! Opening SSLCommerz payment...");
      if (payment?.checkoutUrl) {
        window.location.href = payment.checkoutUrl;
      }
      setSelectedSlotId("");
      slotsQuery.refetch();
    },
    onError: (error) => {
      if (error?.status === 401) {
        navigate("/auth/login", {
          state: { from: "/#venues", notice: getBookingAuthMessage(error) },
        });
        return;
      }
      setFeedback(getBookingAuthMessage(error) || "Booking failed. Please try again.");
    },
  });

  const selectVenue = (resourceId) => {
    setSelectedResourceId(resourceId);
    setSelectedDate(today);
    setSelectedPackageId("");
    setSelectedSlotId("");
    setSelectedFormat(FORMAT_OPTIONS[0]);
    setFeedback("");
  };

  const handleSelectVenueDesktop = (resourceId) => {
    if (resourceId === selectedResourceId) return;
    selectVenue(resourceId);
  };

  const handleToggleVenueMobile = (resourceId) => {
    if (selectedResourceId === resourceId) {
      setSelectedResourceId("");
      setSelectedSlotId("");
      setFeedback("");
      return;
    }
    selectVenue(resourceId);
    requestAnimationFrame(() => {
      document.getElementById(`booking-venue-${resourceId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleFormatChange = (e) => {
    const value = e.target.value;
    setSelectedFormat(value);
    const pkg = packages.find((item) => item.name === value);
    setSelectedPackageId(pkg?._id ?? "");
    setSelectedSlotId("");
  };

  const handleConfirmBooking = () => {
    if (!token) {
      navigate("/auth/login", { state: { from: "/#venues", notice: "Please log in to book a venue." } });
      return;
    }
    if (user?.role && user.role !== "user") {
      setFeedback("Only customer accounts can book venues. Log in with a user account.");
      return;
    }
    if (!guestName.trim() || !guestPhone.trim()) {
      setFeedback("Please enter your name and phone number.");
      return;
    }
    if (!selectedSlotId) {
      setFeedback("Please select a time slot first.");
      return;
    }
    setFeedback("");
    bookMutation.mutate();
  };

  const handleDateSelect = (iso) => {
    setSelectedDate(iso);
    setSelectedSlotId("");
  };

  const bookingSummary = selectedSlot
    ? `${formatTime12h(selectedSlot.startTime)} · ${selectedPackage ? `${selectedPackage.durationMinutes} min` : "60 min"}`
    : "Pick a time slot";

  const guestFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <DsFieldLabel>Name</DsFieldLabel>
        <DsInput
          type="text"
          placeholder="Your name"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
        />
      </label>
      <label className="block">
        <DsFieldLabel>Phone</DsFieldLabel>
        <DsInput
          type="tel"
          placeholder="Your phone"
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
        />
      </label>
    </div>
  );

  const slotGrid = (
    <SlotGrid
      slots={bookableSlots}
      selectedSlotId={selectedSlotId}
      onSelect={setSelectedSlotId}
      isLoading={slotsQuery.isLoading}
    />
  );

  const bookingStepsProps = {
    visitDates,
    selectedDate,
    onDateSelect: handleDateSelect,
    slotGrid,
    guestFields,
    selectedFormat,
    packages,
    onFormatChange: handleFormatChange,
    bookingSummary,
    bookingTotal,
    feedback,
    onConfirm: handleConfirmBooking,
    confirmDisabled: bookMutation.isPending || !selectedSlotId,
    confirmPending: bookMutation.isPending,
    onViewVenue: () => selectedResource && navigate(getVenuePath(selectedResource)),
  };

  const renderVenueList = (mode) =>
    visibleResources.map((resource, index) => {
      const status = getVenueStatus(
        slotPreviews[index]?.data ?? [],
        today,
        slotPreviews[index]?.isLoading
      );
      const isExpanded = selectedResourceId === resource._id;

      if (mode === "mobile") {
        return (
          <article
            key={resource._id}
            id={`booking-venue-${resource._id}`}
            className={`booking-venue-card ${isExpanded ? "is-expanded" : ""}`}
          >
            <VenueCardHead
              resource={resource}
              status={status}
              isExpanded={isExpanded}
              onToggle={() => handleToggleVenueMobile(resource._id)}
            />
            {isExpanded ? (
              <div className="booking-venue-card-body">
                <VenueBookingSteps {...bookingStepsProps} compactConfirm />
              </div>
            ) : null}
          </article>
        );
      }

      return (
        <button
          key={resource._id}
          type="button"
          onClick={() => handleSelectVenueDesktop(resource._id)}
          className={`relative w-full rounded-xl border bg-white p-5 text-left shadow-sm transition hover:shadow-md ${
            isExpanded
              ? "border-ds-accent border-l-[5px] pl-[calc(1.25rem-1px)] shadow-md"
              : "border-slate-200"
          }`}
        >
          <span
            className={`absolute right-4 top-4 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase ${
              status.available ? "bg-ds-accent text-ds-dark" : "bg-red-500 text-white"
            }`}
          >
            {status.label}
          </span>
          <p className="mb-0.5 text-[10px] font-semibold uppercase text-ds-muted">Today</p>
          <h3 className="pr-28 text-lg font-extrabold uppercase tracking-wide text-ds-secondary">
            {resource.name}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ds-muted">
            <span className="inline-flex items-center gap-1.5">
              <FiMapPin className="shrink-0 text-ds-primary" />
              {resource.locationName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FiLayers className="shrink-0 text-ds-primary" />
              {getSurfaceLabel((resource.type || "").toLowerCase())}
            </span>
          </div>
        </button>
      );
    });

  return (
    <section id="venues" className="scroll-mt-24 bg-ds-bg py-12 md:py-16 lg:py-20 booking-section-pad-bottom">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="booking-section-header">
          <HomeSectionHeading
            align="left"
            className="!mb-0"
            eyebrow="Court Booking"
            title="Reserve Your Pitch"
            description="Pick a sport, choose a venue, and book your slot."
          />
          <Link to="/discover" className="booking-view-all-btn">
            <span>View All Courts</span>
            <span className="booking-view-all-btn-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>

        <VenueAreaSearch
          value={areaSearch}
          onChange={setAreaSearch}
          suggestions={areaSuggestions}
        />

        <VenueCategoryBar
          categories={categories}
          selectedKey={selectedCategoryKey}
          onSelect={setSelectedCategoryKey}
        />

        {!isDesktopBooking ? (
          <>
            {filteredResources.length > 1 ? (
              <p className="booking-venues-hint">
                {filteredResources.length} venues · tap a card to expand and book
              </p>
            ) : null}
            <div className="booking-venue-list">
              {renderVenueList("mobile")}
              {!filteredResources.length ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-ds-muted">
                  {emptyVenueMessage}
                </p>
              ) : null}
              {hasMore ? (
                <button
                  type="button"
                  className="text-sm font-bold uppercase tracking-wide text-ds-primary hover:text-ds-secondary"
                  onClick={() => setShowAll((prev) => !prev)}
                >
                  {showAll ? "Show Less" : `See More (${filteredResources.length - MAX_VISIBLE} more)`}
                </button>
              ) : null}
            </div>

            {selectedResource ? (
              <div className="booking-sticky-bar" role="region" aria-label="Quick confirm">
                <div className="booking-sticky-inner">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ds-muted">Total</p>
                    <p className="text-lg font-extrabold leading-tight text-ds-secondary">{bookingTotal} BDT</p>
                    <p className="truncate text-xs text-ds-muted">{bookingSummary}</p>
                  </div>
                  <button
                    type="button"
                    className="booking-sticky-confirm"
                    onClick={handleConfirmBooking}
                    disabled={bookMutation.isPending || !selectedSlotId}
                  >
                    {bookMutation.isPending ? "…" : "Confirm"}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_460px]">
            <div className="space-y-3">
              {renderVenueList("desktop")}
              {!filteredResources.length ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-ds-muted">
                  {emptyVenueMessage}
                </p>
              ) : null}
              {hasMore ? (
                <div className="pt-2">
                  <button
                    type="button"
                    className="text-sm font-bold uppercase tracking-wide text-ds-primary hover:text-ds-secondary"
                    onClick={() => setShowAll((prev) => !prev)}
                  >
                    {showAll ? "Show Less" : `See More (${filteredResources.length - MAX_VISIBLE} more)`}
                  </button>
                </div>
              ) : null}
            </div>

            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-xl xl:sticky xl:top-24">
              {selectedResource ? (
                <>
                  <h3 className="text-xl font-extrabold uppercase tracking-wide text-ds-secondary">
                    Book {selectedResource.name}
                  </h3>
                  <div className="mt-5">
                    <VenueBookingSteps {...bookingStepsProps} />
                  </div>
                </>
              ) : (
                <p className="text-sm text-ds-muted">Select a venue to start booking.</p>
              )}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
