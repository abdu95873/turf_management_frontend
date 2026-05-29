import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { fetchPaymentMethods } from "../../lib/payments";
import { getBookingAmountDue } from "../../lib/bookingPayment";
import { Field, FormGrid, Input, Select } from "../../pages/dashboard/shared/PageChrome";

const EMPTY_FORM = {
  amount: "",
  paymentMethodCode: "",
  transactionId: "",
  note: "",
};

export default function ManualPaymentForm({
  booking,
  defaultAmount,
  onSubmit,
  onValuesChange,
  isSubmitting = false,
  submitLabel = "Record payment",
  hideSubmit = false,
}) {
  const amountDue = booking ? getBookingAmountDue(booking) : defaultAmount ?? 0;
  const [form, setForm] = useState(EMPTY_FORM);

  const methodsQuery = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
  });

  const methods = methodsQuery.data ?? [];
  const selectedMethod = useMemo(
    () => methods.find((method) => method.code === form.paymentMethodCode),
    [methods, form.paymentMethodCode]
  );

  useEffect(() => {
    const initialAmount = amountDue > 0 ? String(amountDue) : "";
    setForm((current) => ({
      ...EMPTY_FORM,
      amount: initialAmount,
      paymentMethodCode: methods[0]?.code ?? current.paymentMethodCode,
    }));
  }, [booking?._id, amountDue, methods[0]?.code]);

  const parsedAmount = Number(form.amount);
  const requiresTrx = selectedMethod?.requiresTransactionId !== false;
  const trxOk = !requiresTrx || form.transactionId.trim().length >= 4;
  const canSubmit =
    parsedAmount > 0 &&
    parsedAmount <= amountDue + 0.001 &&
    Boolean(form.paymentMethodCode) &&
    trxOk &&
    !isSubmitting;

  useEffect(() => {
    if (!onValuesChange) return;
    onValuesChange({
      amount: parsedAmount,
      paymentMethodCode: form.paymentMethodCode,
      transactionId: form.transactionId.trim() || undefined,
      note: form.note.trim(),
      isValid: canSubmit,
    });
  }, [form, parsedAmount, canSubmit, onValuesChange]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      amount: parsedAmount,
      paymentMethodCode: form.paymentMethodCode,
      transactionId: form.transactionId.trim() || undefined,
      note: form.note.trim(),
    });
  }

  return (
    <form className="booking-mgmt-payment-form" onSubmit={handleSubmit}>
      <p className="booking-mgmt-cancel-lead">
        Total {booking?.amount ?? defaultAmount ?? 0} BDT · Paid {booking?.amountPaid ?? 0} BDT · Due{" "}
        <strong>{amountDue} BDT</strong>
      </p>
      <FormGrid columns={2}>
        <Field label="Payment amount (BDT)" htmlFor="manual-pay-amount">
          <Input
            id="manual-pay-amount"
            type="number"
            min="1"
            max={amountDue}
            step="1"
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
          />
        </Field>
        <Field label="Payment method" htmlFor="manual-pay-method">
          <Select
            id="manual-pay-method"
            value={form.paymentMethodCode}
            onChange={(event) => setForm((current) => ({ ...current, paymentMethodCode: event.target.value }))}
            disabled={methodsQuery.isLoading || !methods.length}
          >
            {!methods.length ? <option value="">Loading…</option> : null}
            {methods.map((method) => (
              <option key={method._id} value={method.code}>
                {method.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={requiresTrx ? "Transaction ID" : "Transaction ID (optional)"}
          htmlFor="manual-pay-trx"
        >
          <Input
            id="manual-pay-trx"
            value={form.transactionId}
            onChange={(event) => setForm((current) => ({ ...current, transactionId: event.target.value }))}
            placeholder={requiresTrx ? "bKash / Nagad / Rocket ref" : "Receipt or note"}
          />
        </Field>
        <Field label="Note (optional)" htmlFor="manual-pay-note">
          <Input
            id="manual-pay-note"
            value={form.note}
            onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
            placeholder="Sender number or internal note"
          />
        </Field>
      </FormGrid>
      {hideSubmit ? null : (
        <div className="booking-mgmt-review-actions">
          <button type="submit" className="booking-mgmt-btn booking-mgmt-btn-confirm" disabled={!canSubmit}>
            {isSubmitting ? "Saving…" : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}
