import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getBookingAuthMessage } from "../../lib/api";
import {
  createBooking,
  paymentStatusLabel,
  submitManualPayment,
} from "../../lib/payments";
import ManualPaymentForm from "./ManualPaymentForm";

export default function BookingPaymentPanel({ slotId, amount, onComplete, className = "" }) {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState("online");
  const [pendingBooking, setPendingBooking] = useState(null);
  const [feedback, setFeedback] = useState("");

  const ensureCanBook = () => {
    if (!token) {
      navigate("/auth/login", { state: { notice: "Please log in to book a venue." } });
      return false;
    }
    if (user?.role && user.role !== "user") {
      setFeedback("Only customer accounts can book venues. Log in with a user account.");
      return false;
    }
    return true;
  };

  const bookMutation = useMutation({
    mutationFn: async () => {
      const booking = await createBooking(token, slotId);
      if (paymentMethod === "manual") {
        return { booking, mode: "manual" };
      }
      return { booking, mode: "online" };
    },
    onSuccess: (result) => {
      if (result.mode === "online") {
        navigate(`/payment?bookingId=${result.booking._id}`, { replace: true });
        onComplete?.(result.booking);
      } else {
        setPendingBooking({
          ...result.booking,
          amount: result.booking.amount ?? amount,
          amountPaid: result.booking.amountPaid ?? 0,
        });
        setFeedback("Booking created. Record your payment below.");
      }
    },
    onError: (error) => {
      if (error?.status === 401) {
        navigate("/auth/login", { state: { notice: getBookingAuthMessage(error) } });
        return;
      }
      setFeedback(getBookingAuthMessage(error) || "Booking failed.");
    },
  });

  const manualMutation = useMutation({
    mutationFn: (payload) => submitManualPayment(token, pendingBooking._id, payload),
    onSuccess: (result) => {
      setFeedback(result.message || "Payment submitted for review.");
      setPendingBooking(null);
      onComplete?.(result.booking);
    },
    onError: (error) => {
      setFeedback(getBookingAuthMessage(error) || "Failed to submit payment.");
    },
  });

  const handleBook = () => {
    if (!ensureCanBook()) return;
    if (!slotId) {
      setFeedback("Please select a time slot first.");
      return;
    }
    setFeedback("");
    bookMutation.mutate();
  };

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Payment Method</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setPaymentMethod("manual")}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${
              paymentMethod === "manual"
                ? "border-ds-primary bg-white text-ds-primary shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-ds-primary/40"
            }`}
          >
            Manual payment
            <span className="mt-0.5 block text-xs font-normal text-slate-500">bKash, Nagad, Rocket, or cash</span>
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("online")}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition ${
              paymentMethod === "online"
                ? "border-ds-primary bg-white text-ds-primary shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-ds-primary/40"
            }`}
          >
            SSLCommerz
            <span className="mt-0.5 block text-xs font-normal text-slate-500">Sandbox checkout</span>
          </button>
        </div>
      </div>

      {amount ? (
        <p className="text-sm font-bold text-ds-secondary">
          Amount: <span className="text-ds-primary">{amount} BDT</span>
        </p>
      ) : null}

      {!pendingBooking ? (
        <button
          type="button"
          className="w-full rounded-xl bg-ds-secondary px-4 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-ds-primary disabled:opacity-60"
          disabled={!slotId || bookMutation.isPending}
          onClick={handleBook}
        >
          {bookMutation.isPending
            ? "Processing..."
            : paymentMethod === "manual"
              ? "Create Booking Request"
              : "Book & Pay with SSLCommerz"}
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-ds-accent/40 bg-ds-accent/10 p-4">
          <p className="text-sm font-semibold text-ds-secondary">
            {paymentStatusLabel("awaiting_approval")} — submit payment for owner verification.
          </p>
          <ManualPaymentForm
            booking={pendingBooking}
            isSubmitting={manualMutation.isPending}
            submitLabel="Submit for approval"
            onSubmit={(payload) => manualMutation.mutate(payload)}
          />
        </div>
      )}

      {feedback ? (
        <p
          className={`text-sm font-medium ${bookMutation.isError || manualMutation.isError ? "text-red-600" : "text-ds-primary"}`}
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
