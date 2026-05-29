export function sumApprovedPayments(booking) {
  return (booking?.manualPayments ?? [])
    .filter((payment) => payment.status === "approved")
    .reduce((sum, payment) => sum + (payment.amount ?? 0), 0);
}

export function getEffectiveAmountPaid(booking) {
  const fromLedger = sumApprovedPayments(booking);
  if (fromLedger > 0) {
    return fromLedger;
  }
  const stored = booking?.amountPaid ?? 0;
  if (stored > 0) {
    return stored;
  }
  if (
    booking?.manualTransactionId &&
    booking?.paymentStatus === "paid" &&
    typeof booking?.amount === "number"
  ) {
    return booking.amount;
  }
  return 0;
}

export function getBookingAmountDue(booking) {
  const total = booking?.amount ?? 0;
  const paid = getEffectiveAmountPaid(booking);
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

export function isBookingFullyPaid(booking) {
  return booking?.paymentStatus === "paid" || getBookingAmountDue(booking) <= 0;
}

export function hasRecordedPayment(booking) {
  return getEffectiveAmountPaid(booking) > 0;
}

export function canRecordManualPayment(booking) {
  if (!booking) return false;
  if (["pending", "refunded"].includes(booking.paymentStatus)) return false;
  if (booking.bookingStatus === "refunded") return false;
  return getBookingAmountDue(booking) > 0;
}

export function canReconfirmCancelled(booking) {
  return booking?.bookingStatus === "cancelled" && hasRecordedPayment(booking);
}
