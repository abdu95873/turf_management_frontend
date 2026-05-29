import { useMemo, useState } from "react";
import { FiDollarSign, FiRefreshCw, FiTrendingDown, FiTrendingUp, FiUsers } from "react-icons/fi";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import { api, authHeaders } from "../../../lib/api";
import AdminCommissionSection from "../admin/AdminCommissionSection";
import AdminPaymentMethodsSection from "../../../components/admin/AdminPaymentMethodsSection";
import DashboardFiltersBar from "../../../components/dashboard/DashboardFiltersBar";
import {
  Alert,
  DashboardCard,
  DashboardPage,
  Field,
  Input,
  ProgressBar,
  StatCard,
  StatGrid,
} from "../shared/PageChrome";

function buildEarningsUrl(basePath, fromDate, toDate) {
  const params = new URLSearchParams();
  if (fromDate) params.set("from", fromDate);
  if (toDate) params.set("to", toDate);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function FinanceDateFilter({ fromDate, toDate, dateHint, onFromChange, onToChange, onClear }) {
  const hasFilter = Boolean(fromDate || toDate);
  return (
    <DashboardFiltersBar
      hint={hasFilter ? dateHint : "All dates"}
      onClear={hasFilter ? onClear : undefined}
      clearLabel="Clear dates"
    >
      <div className="dashboard-filters-grid dashboard-filters-grid-dates">
        <Field label="From date" htmlFor="finance-from-date" className="dashboard-filters-field">
          <Input
            id="finance-from-date"
            type="date"
            value={fromDate}
            onChange={(event) => onFromChange(event.target.value)}
          />
        </Field>
        <Field label="To date" htmlFor="finance-to-date" className="dashboard-filters-field">
          <Input
            id="finance-to-date"
            type="date"
            value={toDate}
            onChange={(event) => onToChange(event.target.value)}
          />
        </Field>
      </div>
    </DashboardFiltersBar>
  );
}

function OwnerFinancePanel() {
  const { token } = useAuth();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const earningsQuery = useQuery({
    queryKey: ["owner-earnings", fromDate, toDate],
    queryFn: () =>
      api(buildEarningsUrl("/api/owner/earnings", fromDate, toDate), { headers: authHeaders(token) }),
  });

  const confirmed = earningsQuery.data?.confirmed?.totalAmount ?? 0;
  const pending = earningsQuery.data?.pending?.totalAmount ?? 0;
  const refunded = earningsQuery.data?.refunded?.totalAmount ?? 0;
  const noShow = earningsQuery.data?.no_show?.totalAmount ?? 0;
  const gross = earningsQuery.data?.grossRevenue ?? confirmed + pending + noShow;
  const net = earningsQuery.data?.netRevenue ?? confirmed + noShow;
  const refundRate = gross > 0 ? Math.round((refunded / gross) * 100) : 0;
  const noShowRate = gross > 0 ? Math.round((noShow / gross) * 100) : 0;

  const dateHint = useMemo(() => {
    if (fromDate && toDate) return `${fromDate} → ${toDate}`;
    if (fromDate) return `From ${fromDate}`;
    if (toDate) return `Until ${toDate}`;
    return "All dates";
  }, [fromDate, toDate]);

  return (
    <>
      <FinanceDateFilter
        fromDate={fromDate}
        toDate={toDate}
        dateHint={dateHint}
        onFromChange={setFromDate}
        onToChange={setToDate}
        onClear={() => {
          setFromDate("");
          setToDate("");
        }}
      />

      <StatGrid>
        <StatCard
          label="Gross revenue"
          value={`${gross} BDT`}
          hint="Confirmed + pending + absent"
          icon={FiDollarSign}
          tone="accent"
        />
        <StatCard
          label="Net revenue"
          value={`${net} BDT`}
          hint="Confirmed + absent"
          icon={FiTrendingDown}
          tone="success"
        />
        <StatCard
          label="Confirmed"
          value={`${confirmed} BDT`}
          hint={`${earningsQuery.data?.confirmed?.count ?? 0} bookings`}
          icon={FiTrendingUp}
          tone="success"
        />
        <StatCard
          label="Refunded"
          value={`${refunded} BDT`}
          hint={
            gross > 0
              ? `${refundRate}% of gross · ${earningsQuery.data?.refunded?.count ?? 0} bookings`
              : `${earningsQuery.data?.refunded?.count ?? 0} bookings`
          }
          icon={FiRefreshCw}
          tone="warning"
        />
        <StatCard
          label="Absent"
          value={`${noShow} BDT`}
          hint={gross > 0 ? `${noShowRate}% of gross · ${earningsQuery.data?.no_show?.count ?? 0} bookings` : `${earningsQuery.data?.no_show?.count ?? 0} bookings`}
          icon={FiUsers}
          tone="danger"
        />
      </StatGrid>

      <div className="dashboard-split">
        <DashboardCard title="Earnings breakdown">
          {earningsQuery.isLoading ? <p className="dashboard-field-hint">Loading analytics…</p> : null}
          <ul className="dashboard-detail-list">
            <li>
              <span>Confirmed</span>
              <strong>
                {confirmed} BDT ({earningsQuery.data?.confirmed?.count ?? 0})
              </strong>
            </li>
            <li>
              <span>Pending</span>
              <strong>
                {pending} BDT ({earningsQuery.data?.pending?.count ?? 0})
              </strong>
            </li>
            <li>
              <span>Absent</span>
              <strong>
                {noShow} BDT ({earningsQuery.data?.no_show?.count ?? 0})
              </strong>
            </li>
            <li>
              <span>Refunded</span>
              <strong>
                {refunded} BDT ({earningsQuery.data?.refunded?.count ?? 0})
              </strong>
            </li>
            <li>
              <span>Gross revenue</span>
              <strong>{gross} BDT</strong>
            </li>
            <li>
              <span>Net revenue</span>
              <strong>{net} BDT</strong>
            </li>
          </ul>
        </DashboardCard>

        <DashboardCard title="Revenue health">
          <ProgressBar label="Confirmed share" value={confirmed} max={gross || 1} />
          <ProgressBar label="Pending share" value={pending} max={gross || 1} />
          <ProgressBar label="Absent share" value={noShow} max={gross || 1} />
        </DashboardCard>
      </div>
    </>
  );
}

function AdminFinancePanel() {
  const { token } = useAuth();
  const [message, setMessage] = useState("");
  const [commissionRate, setCommissionRate] = useState("10");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const statsQuery = useQuery({
    queryKey: ["admin-stats", fromDate, toDate],
    queryFn: () =>
      api(buildEarningsUrl("/api/admin/stats", fromDate, toDate), { headers: authHeaders(token) }),
  });

  const stats = statsQuery.data ?? {};
  const grossRevenue = stats.grossRevenue ?? stats.totalRevenue ?? 0;
  const netRevenue = stats.netRevenue ?? 0;
  const totalRefund = stats.totalRefund ?? 0;

  const dateHint = useMemo(() => {
    if (fromDate && toDate) return `${fromDate} → ${toDate}`;
    if (fromDate) return `From ${fromDate}`;
    if (toDate) return `Until ${toDate}`;
    return "All dates";
  }, [fromDate, toDate]);

  return (
    <>
      {message ? <Alert tone="success">{message}</Alert> : null}

      <FinanceDateFilter
        fromDate={fromDate}
        toDate={toDate}
        dateHint={dateHint}
        onFromChange={setFromDate}
        onToChange={setToDate}
        onClear={() => {
          setFromDate("");
          setToDate("");
        }}
      />

      <StatGrid>
        <StatCard
          label="Gross revenue"
          value={`${grossRevenue} BDT`}
          hint="Confirmed + pending + absent"
          icon={FiDollarSign}
          tone="accent"
        />
        <StatCard
          label="Net revenue"
          value={`${netRevenue} BDT`}
          hint="Confirmed + absent"
          icon={FiTrendingDown}
          tone="success"
        />
        <StatCard label="Refunded" value={`${totalRefund} BDT`} icon={FiRefreshCw} tone="warning" />
        <StatCard label="Bookings" value={stats.totalBookings ?? 0} hint="In selected date range" icon={FiUsers} tone="neutral" />
      </StatGrid>
      <AdminCommissionSection
        commissionRate={commissionRate}
        setCommissionRate={setCommissionRate}
        setMessage={setMessage}
      />
      <AdminPaymentMethodsSection />
    </>
  );
}

export default function FinanceModulePage() {
  const { user } = useAuth();

  return (
    <DashboardPage
      title="Finance"
      subtitle={user?.role === "admin" ? "Platform revenue and commission settings" : "Venue earnings and payout health"}
    >
      {user?.role === "admin" ? <AdminFinancePanel /> : <OwnerFinancePanel />}
    </DashboardPage>
  );
}
