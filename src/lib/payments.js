import { api, authHeaders } from "./api";

export const DEFAULT_ONLINE_PAYMENT_PROVIDER =
  import.meta.env.VITE_PAYMENT_PROVIDER ?? "sslcommerz";

export async function createBooking(token, slotId) {
  return api("/api/bookings", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      slotId,
      idempotencyKey: `${slotId}-${Date.now()}`,
    }),
  });
}

export async function fetchPaymentMethods() {
  return api("/api/payment-methods");
}

export async function fetchAdminPaymentMethods(token) {
  return api("/api/admin/payment-methods", { headers: authHeaders(token) });
}

export async function createAdminPaymentMethod(token, payload) {
  return api("/api/admin/payment-methods", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export async function updateAdminPaymentMethod(token, methodId, payload) {
  return api(`/api/admin/payment-methods/${methodId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export async function submitManualPayment(token, bookingId, payload) {
  return api(`/api/bookings/me/${bookingId}/manual-payment`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export async function recordBookingPayment(token, bookingId, payload) {
  return api(`/api/bookings/${bookingId}/record-payment`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

export async function initiateOnlinePayment(token, bookingId) {
  return api("/api/payments/initiate", {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "x-idempotency-key": `sslcommerz-${bookingId}-${Date.now()}`,
    },
    body: JSON.stringify({
      bookingId,
      provider: DEFAULT_ONLINE_PAYMENT_PROVIDER,
    }),
  });
}

export async function verifySandboxPayment(transactionId, provider = DEFAULT_ONLINE_PAYMENT_PROVIDER, token = null) {
  return api("/api/payments/verify", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      transactionId,
      provider,
      success: true,
    }),
  });
}

export async function fetchPaymentStatus({ tranId, bookingId }) {
  const params = new URLSearchParams();
  if (tranId) params.set("tran_id", tranId);
  if (bookingId) params.set("bookingId", bookingId);
  return api(`/api/payments/status?${params.toString()}`);
}

export function paymentStatusLabel(status) {
  if (status === "manual_pending") return "Payment required";
  if (status === "partial_paid") return "Partially paid";
  if (status === "awaiting_approval") return "Awaiting verification";
  if (status === "pending") return "Online payment pending";
  if (status === "paid") return "Paid";
  if (status === "failed") return "Payment failed";
  if (status === "refunded") return "Refunded";
  return status;
}
