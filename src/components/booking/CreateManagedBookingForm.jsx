import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiSearch, FiUser } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { api, authHeaders } from "../../lib/api";
import { formatTimeRange } from "../../lib/slotTime";
import ManualPaymentForm from "./ManualPaymentForm";
import {
  Alert,
  Button,
  DashboardCard,
  Field,
  FormGrid,
  Input,
  Select,
} from "../../pages/dashboard/shared/PageChrome";

const BOOKING_ROLES = new Set(["owner", "staff", "admin"]);

export default function CreateManagedBookingForm({ onCreated }) {
  const { token, user } = useAuth();
  const canCreate = BOOKING_ROLES.has(user?.role);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slotId, setSlotId] = useState("");
  const [customerMode, setCustomerMode] = useState("registered");
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [paymentValues, setPaymentValues] = useState({ isValid: false });

  const resourcesQuery = useQuery({
    queryKey: ["managed-booking-resources"],
    queryFn: () => api("/api/bookings/manage/resources", { headers: authHeaders(token) }),
    enabled: canCreate && open,
  });

  const slotsQuery = useQuery({
    queryKey: ["managed-booking-slots", resourceId, date],
    queryFn: () => api(`/api/slots?resourceId=${resourceId}&date=${date}`),
    enabled: canCreate && open && Boolean(resourceId && date),
  });

  const customersQuery = useQuery({
    queryKey: ["managed-booking-customers", customerQuery],
    queryFn: () =>
      api(`/api/bookings/manage/customers?q=${encodeURIComponent(customerQuery.trim())}`, {
        headers: authHeaders(token),
      }),
    enabled: canCreate && open && customerMode === "registered" && customerQuery.trim().length >= 2 && !selectedCustomer,
  });

  const availableSlots = useMemo(
    () => (slotsQuery.data ?? []).filter((slot) => slot.status === "available"),
    [slotsQuery.data]
  );

  const selectedSlot = availableSlots.find((slot) => slot._id === slotId) ?? null;
  const selectedResource = (resourcesQuery.data ?? []).find((resource) => resource._id === resourceId) ?? null;
  const slotAmount = selectedSlot?.pricePerHour ?? selectedResource?.pricePerHour ?? 0;
  const paymentBooking = selectedSlot
    ? { _id: "new", amount: slotAmount, amountPaid: 0, amountDue: slotAmount }
    : null;

  const hasCustomer =
    customerMode === "registered"
      ? Boolean(selectedCustomer)
      : guestName.trim().length >= 2 && guestPhone.trim().length >= 6;

  useEffect(() => {
    setSlotId("");
  }, [resourceId, date]);

  useEffect(() => {
    if (customerMode !== "registered" || !selectedCustomer) return;
    if (customerQuery !== selectedCustomer.email) {
      setSelectedCustomer(null);
    }
  }, [customerQuery, selectedCustomer, customerMode]);

  const createMutation = useMutation({
    mutationFn: () =>
      api("/api/bookings/manage", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          ...(customerMode === "registered" && selectedCustomer ? { userId: selectedCustomer.id } : {}),
          ...(customerMode === "walkin"
            ? { guestName: guestName.trim(), guestPhone: guestPhone.trim() }
            : {}),
          slotId,
          idempotencyKey: `managed-${slotId}-${Date.now()}`,
          amount: paymentValues.amount,
          paymentMethodCode: paymentValues.paymentMethodCode,
          transactionId: paymentValues.transactionId,
          note: paymentValues.note ?? "",
        }),
      }),
    onSuccess: (result) => {
      const who = result.customer?.walkIn
        ? result.customer.name
        : (result.customer?.name ?? "customer");
      setMessage(`Booking confirmed for ${who} — ${result.booking?.amount ?? ""} BDT`);
      setError("");
      setSlotId("");
      setPaymentValues({ isValid: false });
      setCustomerQuery("");
      setSelectedCustomer(null);
      setGuestName("");
      setGuestPhone("");
      onCreated?.();
    },
    onError: (err) => {
      setError(err?.message ?? "Could not create booking");
      setMessage("");
    },
  });

  if (!canCreate) return null;

  const canSubmit = Boolean(hasCustomer && slotId && paymentValues.isValid) && !createMutation.isPending;

  return (
    <DashboardCard
      title="Book for customer"
      description="Search a registered customer or add walk-in name and phone."
      actions={
        <Button type="button" variant="ghost" className="dashboard-btn-sm" onClick={() => setOpen((current) => !current)}>
          <FiPlus aria-hidden="true" />
          {open ? "Close" : "New booking"}
        </Button>
      }
    >
      {open ? (
        <div className="dashboard-form-stack">
          {message ? <Alert tone="success">{message}</Alert> : null}
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <FormGrid columns={2}>
            <Field label="Venue" htmlFor="managed-booking-venue">
              <Select
                id="managed-booking-venue"
                value={resourceId}
                onChange={(event) => setResourceId(event.target.value)}
              >
                <option value="">Select venue</option>
                {(resourcesQuery.data ?? []).map((resource) => (
                  <option key={resource._id} value={resource._id}>
                    {resource.name}
                    {resource.isActive === false ? " (inactive)" : ""}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Date" htmlFor="managed-booking-date">
              <Input
                id="managed-booking-date"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
          </FormGrid>

          <Field label="Available slot" htmlFor="managed-booking-slot">
            <Select
              id="managed-booking-slot"
              value={slotId}
              disabled={!resourceId || slotsQuery.isLoading}
              onChange={(event) => setSlotId(event.target.value)}
            >
              <option value="">
                {slotsQuery.isLoading
                  ? "Loading slots…"
                  : !resourceId
                    ? "Select a venue first"
                    : availableSlots.length
                      ? "Select time slot"
                      : "No available slots for this date"}
              </option>
              {availableSlots.map((slot) => (
                <option key={slot._id} value={slot._id}>
                  {formatTimeRange(slot.startTime, slot.endTime)}
                </option>
              ))}
            </Select>
          </Field>

          {selectedSlot && selectedResource ? (
            <p className="dashboard-form-summary">
              {selectedResource.name} · {formatTimeRange(selectedSlot.startTime, selectedSlot.endTime)} ·{" "}
              <strong>{slotAmount} BDT</strong>
            </p>
          ) : null}

          <Field label="Customer type" htmlFor="managed-booking-customer-mode">
            <Select
              id="managed-booking-customer-mode"
              value={customerMode}
              onChange={(event) => {
                setCustomerMode(event.target.value);
                setSelectedCustomer(null);
                setCustomerQuery("");
              }}
            >
              <option value="registered">Registered customer (search)</option>
              <option value="walkin">Walk-in (name & phone)</option>
            </Select>
          </Field>

          {customerMode === "registered" ? (
            <>
              <Field label="Search customer" htmlFor="managed-booking-customer">
                <div className="dashboard-search-field">
                  <FiSearch className="dashboard-search-field-icon" aria-hidden="true" />
                  <Input
                    id="managed-booking-customer"
                    type="search"
                    placeholder="Search by email or name…"
                    value={customerQuery}
                    onChange={(event) => setCustomerQuery(event.target.value)}
                  />
                </div>
              </Field>

              {selectedCustomer ? (
                <div className="dashboard-pick-selected">
                  <FiUser aria-hidden="true" />
                  <span>
                    {selectedCustomer.name} · {selectedCustomer.email}
                  </span>
                  <button type="button" onClick={() => setSelectedCustomer(null)}>
                    Change
                  </button>
                </div>
              ) : null}

              {!selectedCustomer && customerQuery.trim().length >= 2 ? (
                <div className="dashboard-pick-list">
                  {customersQuery.isLoading ? <p className="dashboard-field-hint">Searching…</p> : null}
                  {!customersQuery.isLoading && !(customersQuery.data ?? []).length ? (
                    <p className="dashboard-field-hint">
                      No registered customer found. Switch to walk-in to book without an account.
                    </p>
                  ) : null}
                  {(customersQuery.data ?? []).map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className="dashboard-pick-option"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setCustomerQuery(customer.email);
                      }}
                    >
                      <strong>{customer.name}</strong>
                      <span>{customer.email}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <FormGrid columns={2}>
              <Field label="Customer name" htmlFor="managed-booking-guest-name">
                <Input
                  id="managed-booking-guest-name"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  placeholder="Full name"
                />
              </Field>
              <Field label="Phone number" htmlFor="managed-booking-guest-phone">
                <Input
                  id="managed-booking-guest-phone"
                  type="tel"
                  value={guestPhone}
                  onChange={(event) => setGuestPhone(event.target.value)}
                  placeholder="01XXXXXXXXX"
                />
              </Field>
            </FormGrid>
          )}

          {paymentBooking && hasCustomer ? (
            <ManualPaymentForm booking={paymentBooking} hideSubmit onValuesChange={setPaymentValues} />
          ) : null}

          <div className="dashboard-form-actions">
            <Button type="button" disabled={!canSubmit} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Booking…" : "Confirm booking"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="dashboard-field-hint">
          Book for a registered user or walk-in guest with manual payment (full or partial).
        </p>
      )}
    </DashboardCard>
  );
}
