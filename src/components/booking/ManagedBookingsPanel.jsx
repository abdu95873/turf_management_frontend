import { useMutation, useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiSearch,
  FiX,
} from "react-icons/fi";
import DashboardFiltersBar from "../dashboard/DashboardFiltersBar";
import CreateManagedBookingForm from "./CreateManagedBookingForm";
import ManualPaymentForm from "./ManualPaymentForm";
import { useAuth } from "../../context/AuthContext";
import { api, authHeaders } from "../../lib/api";
import {
  canReconfirmCancelled,
  canRecordManualPayment,
  getBookingAmountDue,
  getEffectiveAmountPaid,
  isBookingFullyPaid,
} from "../../lib/bookingPayment";
import { paymentStatusLabel, recordBookingPayment } from "../../lib/payments";
import { formatBookingStatusLabel } from "../../lib/bookingStatus";
import { formatTimeRange } from "../../lib/slotTime";
import {
  Alert,
  Badge,
  DashboardCard,
  EmptyState,
  Field,
  Input,
  Select,
  StatCard,
  StatGrid,
} from "../../pages/dashboard/shared/PageChrome";

const FILTERS = [
  { key: "all", label: "All bookings" },
  { key: "approval", label: "Payment review" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "refunded", label: "Refunded" },
];

function bookingBadgeTone(status) {
  if (status === "paid" || status === "confirmed") return "success";
  if (status === "awaiting_approval" || status === "pending" || status === "manual_pending" || status === "partial_paid")
    return "warning";
  if (status === "failed" || status === "cancelled" || status === "refunded" || status === "no_show") return "danger";
  return "neutral";
}

function formatBookingDate(date) {
  if (!date) return "—";
  try {
    const parsed = new Date(`${date}T12:00:00`);
    return parsed.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

function canRefundPayment(booking) {
  return (
    ["paid", "partial_paid", "awaiting_approval", "pending"].includes(booking.paymentStatus) ||
    (booking.amountPaid ?? 0) > 0
  );
}

function cannotConfirmUntilPaymentSettled(booking) {
  return ["awaiting_approval", "pending"].includes(booking.paymentStatus);
}

function canCancelWithRefund(booking) {
  return canRefundPayment(booking);
}

function getPendingPayment(booking) {
  return (booking.manualPayments ?? []).find((payment) => payment.status === "pending");
}

function getPaymentActionLabel(booking, amountDue, isOpen) {
  if (isOpen) return "Close";
  if (booking.bookingStatus === "cancelled") {
    if (canReconfirmCancelled(booking)) {
      return amountDue > 0 ? "Re-confirm" : "Re-confirm";
    }
    return amountDue > 0 ? `Pay due (${amountDue} BDT)` : "Re-confirm";
  }
  if (amountDue > 0) return `Pay due (${amountDue} BDT)`;
  if (booking.bookingStatus === "pending") return "Confirm";
  return "Manage";
}

function getPaymentActionBtnClass(booking, amountDue, isOpen) {
  if (isOpen) return "booking-mgmt-btn-neutral";
  if (booking.bookingStatus === "cancelled") return "booking-mgmt-btn-confirm";
  if (amountDue > 0) return "booking-mgmt-btn-due";
  return "booking-mgmt-btn-confirm";
}

function getCustomerLabel(booking) {
  if (booking.isWalkIn && booking.guestName) {
    return `${booking.guestName}${booking.guestPhone ? ` · ${booking.guestPhone}` : ""}`;
  }
  return null;
}

export default function ManagedBookingsPanel({ title = "Bookings", description }) {
  const { token } = useAuth();
  const [reviewNote, setReviewNote] = useState({});
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [reviewExpandedId, setReviewExpandedId] = useState("");
  const [confirmExpandedId, setConfirmExpandedId] = useState("");
  const [cancelExpandedId, setCancelExpandedId] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const managedBookingsQuery = useQuery({
    queryKey: ["managed-bookings"],
    queryFn: () => api("/api/bookings/manage", { headers: authHeaders(token) }),
  });

  const resourcesQuery = useQuery({
    queryKey: ["booking-mgmt-venues"],
    queryFn: () => api("/api/resources"),
  });

  const resourceMap = useMemo(() => {
    const map = {};
    (resourcesQuery.data ?? []).forEach((resource) => {
      map[resource._id] = resource.name;
    });
    return map;
  }, [resourcesQuery.data]);

  const recordPaymentMutation = useMutation({
    mutationFn: ({ bookingId, payload }) => recordBookingPayment(token, bookingId, payload),
    onSuccess: () => {
      managedBookingsQuery.refetch();
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ bookingId, bookingStatus, paymentStatus }) =>
      api(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({
          bookingStatus,
          ...(paymentStatus ? { paymentStatus } : {}),
        }),
      }),
    onSuccess: () => {
      setReviewExpandedId("");
      setConfirmExpandedId("");
      setCancelExpandedId("");
      managedBookingsQuery.refetch();
    },
  });

  function handleConfirmClick(booking) {
    setReviewExpandedId("");
    setCancelExpandedId("");
    setConfirmExpandedId((current) => (current === booking._id ? "" : booking._id));
  }

  function handleCancelClick(booking) {
    setReviewExpandedId("");
    setConfirmExpandedId("");
    setCancelExpandedId((current) => (current === booking._id ? "" : booking._id));
  }

  function cancelWithRefund(booking) {
    statusMutation.mutate({
      bookingId: booking._id,
      bookingStatus: "refunded",
      paymentStatus: "refunded",
    });
  }

  function cancelWithoutRefund(booking) {
    statusMutation.mutate({
      bookingId: booking._id,
      bookingStatus: "cancelled",
    });
  }

  const reviewMutation = useMutation({
    mutationFn: ({ bookingId, action, note, manualPaymentId }) =>
      api(`/api/bookings/${bookingId}/manual-review`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ action, note, ...(manualPaymentId ? { manualPaymentId } : {}) }),
      }),
    onSuccess: () => {
      setReviewExpandedId("");
      managedBookingsQuery.refetch();
    },
  });

  const bookings = managedBookingsQuery.data ?? [];
  const pendingManual = bookings.filter((booking) => booking.paymentStatus === "awaiting_approval");
  const confirmed = bookings.filter((booking) => booking.bookingStatus === "confirmed");
  const pending = bookings.filter((booking) => booking.bookingStatus === "pending");
  const cancelled = bookings.filter((booking) => booking.bookingStatus === "cancelled");
  const refunded = bookings.filter(
    (booking) => booking.bookingStatus === "refunded" || booking.paymentStatus === "refunded"
  );

  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (filter === "approval") list = pendingManual;
    else if (filter === "confirmed") list = bookings.filter((b) => b.bookingStatus === "confirmed");
    else if (filter === "pending") list = bookings.filter((b) => b.bookingStatus === "pending");
    else if (filter === "cancelled") list = cancelled;
    else if (filter === "refunded") list = refunded;

    if (filterDate) {
      list = list.filter((booking) => booking.bookingDate === filterDate);
    }

    const query = search.trim().toLowerCase();
    if (!query) return list;

    return list.filter((booking) => {
      const venue = resourceMap[booking.resourceId] ?? "";
      const haystack = [
        booking._id,
        booking.bookingDate,
        booking.manualTransactionId,
        venue,
        String(booking.amount),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [bookings, filter, filterDate, pendingManual, cancelled, refunded, search, resourceMap]);

  const filterCounts = useMemo(
    () => ({
      all: filterDate ? bookings.filter((b) => b.bookingDate === filterDate).length : bookings.length,
      approval: pendingManual.length,
      pending: pending.length,
      confirmed: confirmed.length,
      cancelled: cancelled.length,
      refunded: refunded.length,
    }),
    [bookings, filterDate, pendingManual.length, pending.length, confirmed.length, cancelled.length, refunded.length]
  );

  return (
    <>
      <CreateManagedBookingForm onCreated={() => managedBookingsQuery.refetch()} />

      <StatGrid className="booking-mgmt-overview">
        <StatCard label="Total bookings" value={bookings.length} icon={FiCalendar} />
        <StatCard label="Cancelled" value={cancelled.length} tone="danger" icon={FiX} />
        <StatCard label="Refunded" value={refunded.length} tone="warning" icon={FiRefreshCw} />
        <StatCard
          label="Awaiting payment review"
          value={pendingManual.length}
          tone="warning"
          icon={FiAlertCircle}
          hint={pendingManual.length ? "Action required" : "All clear"}
        />
        <StatCard label="Confirmed" value={confirmed.length} tone="success" icon={FiCheckCircle} />
      </StatGrid>

      {pendingManual.length ? (
        <Alert tone="warning">
          <strong>{pendingManual.length}</strong> manual payment{pendingManual.length === 1 ? "" : "s"} awaiting
          verification — review transaction IDs in the Payment review tab.
        </Alert>
      ) : null}

      <DashboardCard
        title={title}
        description={description ?? "Track reservations, verify payments, and update booking status."}
        className="booking-mgmt-panel"
      >
        <DashboardFiltersBar
          hint={
            filter !== "all" || filterDate || search.trim()
              ? [
                  filter !== "all" ? FILTERS.find((f) => f.key === filter)?.label : null,
                  filterDate ? `Date ${filterDate}` : null,
                  search.trim() ? `“${search.trim()}”` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "All bookings"
          }
        >
          <div className="dashboard-filters-search-wrap">
            <FiSearch className="dashboard-filters-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="dashboard-filters-search-input"
              placeholder="Search venue, date, amount, transaction ID…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="dashboard-filters-grid">
            <Field label="Booking date" htmlFor="booking-date-filter" className="dashboard-filters-field">
              <Input
                id="booking-date-filter"
                type="date"
                value={filterDate}
                onChange={(event) => setFilterDate(event.target.value)}
              />
            </Field>
            <Field label="Status" htmlFor="booking-filter" className="dashboard-filters-field">
              <Select id="booking-filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
                {FILTERS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label} ({filterCounts[item.key] ?? 0})
                  </option>
                ))}
              </Select>
            </Field>
            <div className="dashboard-filters-actions">
              <button
                type="button"
                className="dashboard-filters-action-btn dashboard-filters-action-btn-clear"
                disabled={filter === "all" && !filterDate && !search.trim()}
                onClick={() => {
                  setFilter("all");
                  setFilterDate("");
                  setSearch("");
                }}
              >
                <FiX aria-hidden="true" />
                Clear all
              </button>
            </div>
          </div>
        </DashboardFiltersBar>

        {managedBookingsQuery.isLoading ? (
          <p className="booking-mgmt-loading">Loading bookings…</p>
        ) : null}

        {managedBookingsQuery.isError ? (
          <Alert tone="danger">Could not load bookings. Please refresh and try again.</Alert>
        ) : null}

        {!managedBookingsQuery.isLoading && !filteredBookings.length ? (
          <EmptyState
            title="No bookings found"
            description={
              search.trim()
                ? "Try a different search term or clear the filter."
                : "Bookings will appear here when customers reserve your venues."
            }
          />
        ) : null}

        {!managedBookingsQuery.isLoading && filteredBookings.length ? (
          <div className="dashboard-table-wrap booking-mgmt-table-wrap">
            <table className="dashboard-table booking-mgmt-table">
              <thead>
                <tr>
                  <th>Schedule</th>
                  <th>Venue</th>
                  <th>Amount</th>
                  <th>Booking</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((booking) => {
                  const needsReview = booking.paymentStatus === "awaiting_approval";
                  const isReviewOpen = reviewExpandedId === booking._id;
                  const isConfirmOpen = confirmExpandedId === booking._id;
                  const isCancelOpen = cancelExpandedId === booking._id;
                  const isCancelled = booking.bookingStatus === "cancelled";
                  const isRefunded = booking.bookingStatus === "refunded" || booking.paymentStatus === "refunded";
                  const isFinal = ["no_show"].includes(booking.bookingStatus) || isRefunded;
                  const showRefund = canRefundPayment(booking) && isCancelled;
                  const showManageActions =
                    !needsReview && !isCancelled && !isFinal && !cannotConfirmUntilPaymentSettled(booking);
                  const amountPaid = getEffectiveAmountPaid(booking);
                  const amountDue = getBookingAmountDue(booking);
                  const fullyPaid = isBookingFullyPaid(booking);
                  const canRecordPayment = canRecordManualPayment(booking);
                  const allowReconfirmCancelled = canReconfirmCancelled(booking);
                  const pendingPayment = getPendingPayment(booking);
                  const showPayDueButton = amountDue > 0;
                  const customerLabel = getCustomerLabel(booking);
                  const paymentActionLabel = getPaymentActionLabel(booking, amountDue, isConfirmOpen);

                  const cardToneClass = needsReview
                    ? "booking-mgmt-row-card--review"
                    : `booking-mgmt-row-card--${booking.bookingStatus}`;

                  return (
                    <Fragment key={booking._id}>
                      <tr
                        className={[
                          "booking-mgmt-row-card",
                          cardToneClass,
                          needsReview ? "booking-mgmt-row-review" : "",
                          isConfirmOpen || isCancelOpen ? "booking-mgmt-row-card--expanded" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <td data-label="Schedule" className="booking-mgmt-cell-head booking-mgmt-cell-schedule">
                          <p className="booking-mgmt-primary">{formatBookingDate(booking.bookingDate)}</p>
                          <p className="booking-mgmt-muted">
                            {formatTimeRange(booking.startTime, booking.endTime)}
                          </p>
                        </td>
                        <td data-label="Venue" className="booking-mgmt-cell-head booking-mgmt-cell-venue">
                          <p className="booking-mgmt-primary">
                            {resourceMap[booking.resourceId] ?? "Venue"}
                          </p>
                          <p className="booking-mgmt-muted booking-mgmt-id">#{String(booking._id).slice(-8)}</p>
                          {customerLabel ? <p className="booking-mgmt-muted">{customerLabel}</p> : null}
                        </td>
                        <td data-label="Amount" className="booking-mgmt-cell-amount">
                          <p className="booking-mgmt-amount">{booking.amount} BDT</p>
                          <p className="booking-mgmt-muted">
                            Paid {amountPaid} · Due {amountDue}
                          </p>
                        </td>
                        <td data-label="Booking" className="booking-mgmt-cell-badge">
                          <Badge tone={bookingBadgeTone(booking.bookingStatus)}>
                            {formatBookingStatusLabel(booking.bookingStatus)}
                          </Badge>
                        </td>
                        <td data-label="Payment" className="booking-mgmt-cell-badge">
                          <Badge tone={bookingBadgeTone(booking.paymentStatus)}>
                            {paymentStatusLabel(booking.paymentStatus)}
                          </Badge>
                          {booking.manualTransactionId ? (
                            <p className="booking-mgmt-trx">Trx: {booking.manualTransactionId}</p>
                          ) : null}
                        </td>
                        <td data-label="Actions" className="booking-mgmt-cell-actions">
                          {needsReview ? (
                            <button
                              type="button"
                              className={`booking-mgmt-btn ${isReviewOpen ? "booking-mgmt-btn-neutral" : "booking-mgmt-btn-review"}`}
                              onClick={() => setReviewExpandedId(isReviewOpen ? "" : booking._id)}
                            >
                              {isReviewOpen ? "Close" : "Review"}
                            </button>
                          ) : isCancelled ? (
                            <div className="booking-mgmt-actions">
                              <button
                                type="button"
                                className={`booking-mgmt-btn ${getPaymentActionBtnClass(booking, amountDue, isConfirmOpen)}`}
                                disabled={statusMutation.isPending}
                                onClick={() => handleConfirmClick(booking)}
                              >
                                {paymentActionLabel}
                              </button>
                              {showRefund ? (
                                <button
                                  type="button"
                                  className="booking-mgmt-btn booking-mgmt-btn-danger"
                                  disabled={statusMutation.isPending}
                                  onClick={() => cancelWithRefund(booking)}
                                >
                                  Refund
                                </button>
                              ) : (
                                <span className="booking-mgmt-muted">No refund</span>
                              )}
                            </div>
                          ) : showManageActions ? (
                            <div className="booking-mgmt-actions">
                              {showPayDueButton || booking.bookingStatus === "pending" ? (
                                <button
                                  type="button"
                                  className={`booking-mgmt-btn ${getPaymentActionBtnClass(booking, amountDue, isConfirmOpen)}`}
                                  disabled={statusMutation.isPending || cannotConfirmUntilPaymentSettled(booking)}
                                  onClick={() => handleConfirmClick(booking)}
                                >
                                  {paymentActionLabel}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className={`booking-mgmt-btn ${isCancelOpen ? "booking-mgmt-btn-neutral" : "booking-mgmt-btn-cancel"}`}
                                disabled={statusMutation.isPending}
                                onClick={() => handleCancelClick(booking)}
                              >
                                {isCancelOpen ? "Close" : "Cancel"}
                              </button>
                              <button
                                type="button"
                                className="booking-mgmt-btn booking-mgmt-btn-warning"
                                disabled={statusMutation.isPending}
                                onClick={() =>
                                  statusMutation.mutate({ bookingId: booking._id, bookingStatus: "no_show" })
                                }
                              >
                                Absent
                              </button>
                            </div>
                          ) : (
                            <span className="booking-mgmt-muted">—</span>
                          )}
                        </td>
                      </tr>
                      {needsReview && isReviewOpen ? (
                        <tr className="booking-mgmt-review-row">
                          <td colSpan={6}>
                            <div className="booking-mgmt-review-panel">
                              <div className="booking-mgmt-review-meta">
                                <div>
                                  <p className="booking-mgmt-review-label">Submitted payment</p>
                                  <p className="booking-mgmt-review-value">
                                    {pendingPayment
                                      ? `${pendingPayment.amount} BDT via ${pendingPayment.paymentMethodLabel}`
                                      : "—"}
                                  </p>
                                </div>
                                <div>
                                  <p className="booking-mgmt-review-label">Transaction ID</p>
                                  <p className="booking-mgmt-review-value">
                                    {pendingPayment?.transactionId || booking.manualTransactionId || "—"}
                                  </p>
                                </div>
                                {pendingPayment?.note ? (
                                  <div>
                                    <p className="booking-mgmt-review-label">Customer note</p>
                                    <p className="booking-mgmt-review-value">{pendingPayment.note}</p>
                                  </div>
                                ) : null}
                              </div>
                              <Field label="Review note (optional)" htmlFor={`note-${booking._id}`}>
                                <Input
                                  id={`note-${booking._id}`}
                                  value={reviewNote[booking._id] ?? ""}
                                  onChange={(event) =>
                                    setReviewNote((current) => ({
                                      ...current,
                                      [booking._id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Verified sender number or internal note"
                                />
                              </Field>
                              <div className="booking-mgmt-review-actions">
                                <button
                                  type="button"
                                  className="booking-mgmt-btn booking-mgmt-btn-confirm"
                                  disabled={reviewMutation.isPending}
                                  onClick={() =>
                                    reviewMutation.mutate({
                                      bookingId: booking._id,
                                      action: "approve",
                                      note: reviewNote[booking._id] ?? "",
                                      manualPaymentId: pendingPayment?._id,
                                    })
                                  }
                                >
                                  <FiCheck />
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="booking-mgmt-btn booking-mgmt-btn-danger"
                                  disabled={reviewMutation.isPending}
                                  onClick={() =>
                                    reviewMutation.mutate({
                                      bookingId: booking._id,
                                      action: "reject",
                                      note: reviewNote[booking._id] ?? "",
                                      manualPaymentId: pendingPayment?._id,
                                    })
                                  }
                                >
                                  <FiX />
                                  Reject
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      {isConfirmOpen ? (
                        <tr className="booking-mgmt-cancel-row">
                          <td colSpan={6}>
                            <div className="booking-mgmt-review-panel booking-mgmt-cancel-panel">
                              {cannotConfirmUntilPaymentSettled(booking) ? (
                                <p className="booking-mgmt-cancel-lead">
                                  Complete or verify online payment before confirming.
                                </p>
                              ) : (
                                <>
                                  {(booking.manualPayments ?? []).length ? (
                                    <div className="booking-mgmt-payment-history">
                                      <p className="booking-mgmt-review-label">Payment history</p>
                                      <ul className="dashboard-detail-list">
                                        {(booking.manualPayments ?? []).map((payment) => (
                                          <li key={payment._id}>
                                            <span>
                                              {payment.amount} BDT · {payment.paymentMethodLabel} · {payment.status}
                                            </span>
                                            <strong>{payment.transactionId || "—"}</strong>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                  {canRecordPayment && !(isCancelled && allowReconfirmCancelled) ? (
                                    <ManualPaymentForm
                                      booking={{ ...booking, amountPaid, amountDue }}
                                      isSubmitting={recordPaymentMutation.isPending}
                                      submitLabel="Record payment"
                                      onSubmit={(payload) =>
                                        recordPaymentMutation.mutate(
                                          { bookingId: booking._id, payload },
                                          { onSuccess: () => setConfirmExpandedId("") }
                                        )
                                      }
                                    />
                                  ) : null}
                                  {isCancelled && allowReconfirmCancelled && showPayDueButton ? (
                                    <>
                                      <p className="booking-mgmt-muted booking-mgmt-panel-hint">
                                        Past payments: {amountPaid} BDT recorded. You can re-confirm now or
                                        collect the remaining {amountDue} BDT below.
                                      </p>
                                      <ManualPaymentForm
                                        booking={{ ...booking, amountPaid, amountDue }}
                                        isSubmitting={recordPaymentMutation.isPending}
                                        submitLabel="Record additional payment"
                                        onSubmit={(payload) =>
                                          recordPaymentMutation.mutate(
                                            { bookingId: booking._id, payload },
                                            { onSuccess: () => managedBookingsQuery.refetch() }
                                          )
                                        }
                                      />
                                    </>
                                  ) : null}
                                  <div className="booking-mgmt-review-actions">
                                    {isCancelled && allowReconfirmCancelled ? (
                                      <button
                                        type="button"
                                        className="booking-mgmt-btn booking-mgmt-btn-confirm"
                                        disabled={statusMutation.isPending}
                                        onClick={() =>
                                          statusMutation.mutate({
                                            bookingId: booking._id,
                                            bookingStatus: "confirmed",
                                          })
                                        }
                                      >
                                        Re-confirm booking
                                      </button>
                                    ) : null}
                                    {!isCancelled &&
                                    booking.bookingStatus === "pending" &&
                                    !showPayDueButton &&
                                    (booking.amountPaid ?? 0) <= 0 ? (
                                      <button
                                        type="button"
                                        className="booking-mgmt-btn booking-mgmt-btn-confirm"
                                        disabled={statusMutation.isPending}
                                        onClick={() =>
                                          statusMutation.mutate({
                                            bookingId: booking._id,
                                            bookingStatus: "confirmed",
                                          })
                                        }
                                      >
                                        Confirm without payment
                                      </button>
                                    ) : null}
                                    {!isCancelled && showPayDueButton && booking.bookingStatus === "confirmed" ? (
                                      <p className="booking-mgmt-muted booking-mgmt-panel-hint">
                                        Record payment to clear the remaining {amountDue} BDT due.
                                      </p>
                                    ) : null}
                                    {isCancelled && !allowReconfirmCancelled && showPayDueButton ? (
                                      <p className="booking-mgmt-muted booking-mgmt-panel-hint">
                                        Record payment before re-confirming this booking.
                                      </p>
                                    ) : null}
                                    <button
                                      type="button"
                                      className="booking-mgmt-btn booking-mgmt-btn-neutral"
                                      onClick={() => setConfirmExpandedId("")}
                                    >
                                      Back
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      {isCancelOpen ? (
                        <tr className="booking-mgmt-cancel-row">
                          <td colSpan={6}>
                            <div className="booking-mgmt-review-panel booking-mgmt-cancel-panel">
                              <p className="booking-mgmt-cancel-lead">
                                Cancel this booking. Choose whether to refund the customer.
                              </p>
                              <div className="booking-mgmt-review-actions">
                                {canCancelWithRefund(booking) ? (
                                  <button
                                    type="button"
                                    className="booking-mgmt-btn booking-mgmt-btn-danger"
                                    disabled={statusMutation.isPending}
                                    onClick={() => cancelWithRefund(booking)}
                                  >
                                    Cancel with refund
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="booking-mgmt-btn booking-mgmt-btn-cancel"
                                  disabled={statusMutation.isPending}
                                  onClick={() => cancelWithoutRefund(booking)}
                                >
                                  Cancel (no refund)
                                </button>
                                <button
                                  type="button"
                                  className="booking-mgmt-btn booking-mgmt-btn-neutral"
                                  onClick={() => setCancelExpandedId("")}
                                >
                                  Back
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </DashboardCard>
    </>
  );
}
