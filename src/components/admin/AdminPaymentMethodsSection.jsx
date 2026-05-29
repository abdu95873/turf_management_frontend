import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import {
  createAdminPaymentMethod,
  fetchAdminPaymentMethods,
  updateAdminPaymentMethod,
} from "../../lib/payments";
import {
  Alert,
  Button,
  DashboardCard,
  Field,
  FormGrid,
  Input,
  Select,
} from "../../pages/dashboard/shared/PageChrome";

export default function AdminPaymentMethodsSection() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    label: "",
    requiresTransactionId: "true",
  });

  const methodsQuery = useQuery({
    queryKey: ["admin-payment-methods"],
    queryFn: () => fetchAdminPaymentMethods(token),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAdminPaymentMethod(token, {
        code: form.code.trim().toLowerCase(),
        label: form.label.trim(),
        requiresTransactionId: form.requiresTransactionId === "true",
      }),
    onSuccess: () => {
      setMessage("Payment method added.");
      setError("");
      setForm({ code: "", label: "", requiresTransactionId: "true" });
      queryClient.invalidateQueries({ queryKey: ["admin-payment-methods"] });
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
    },
    onError: (err) => {
      setError(err?.message ?? "Could not add method");
      setMessage("");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ methodId, active }) => updateAdminPaymentMethod(token, methodId, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payment-methods"] });
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
    },
  });

  return (
    <DashboardCard title="Manual payment methods" description="Methods shown in manual payment dropdowns across the platform.">
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {methodsQuery.isLoading ? <p className="dashboard-field-hint">Loading methods…</p> : null}
      <ul className="dashboard-detail-list">
        {(methodsQuery.data ?? []).map((method) => (
          <li key={method._id}>
            <span>
              {method.label} <span className="booking-mgmt-muted">({method.code})</span>
            </span>
            <strong>
              <button
                type="button"
                className="dashboard-btn-link"
                onClick={() =>
                  toggleMutation.mutate({ methodId: method._id, active: !method.active })
                }
              >
                {method.active ? "Disable" : "Enable"}
              </button>
            </strong>
          </li>
        ))}
      </ul>

      <FormGrid columns={3}>
        <Field label="Code" htmlFor="pm-code">
          <Input
            id="pm-code"
            value={form.code}
            onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
            placeholder="e.g. upay"
          />
        </Field>
        <Field label="Label" htmlFor="pm-label">
          <Input
            id="pm-label"
            value={form.label}
            onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
            placeholder="Display name"
          />
        </Field>
        <Field label="Transaction ID" htmlFor="pm-trx">
          <Select
            id="pm-trx"
            value={form.requiresTransactionId}
            onChange={(event) =>
              setForm((current) => ({ ...current, requiresTransactionId: event.target.value }))
            }
          >
            <option value="true">Required</option>
            <option value="false">Optional</option>
          </Select>
        </Field>
      </FormGrid>
      <div className="dashboard-form-actions">
        <Button
          type="button"
          disabled={!form.code.trim() || !form.label.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          <FiPlus aria-hidden="true" />
          Add method
        </Button>
      </div>
    </DashboardCard>
  );
}
