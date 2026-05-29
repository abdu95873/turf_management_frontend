import { FiFilter, FiX } from "react-icons/fi";

export default function DashboardFiltersBar({
  title = "Filters",
  hint,
  onClear,
  clearLabel = "Clear all",
  children,
  className = "",
}) {
  return (
    <section className={`dashboard-filters ${className}`.trim()} aria-label={title}>
      <div className="dashboard-filters-header">
        <div className="dashboard-filters-title">
          <FiFilter aria-hidden="true" />
          <span>{title}</span>
          {hint ? <span className="dashboard-filters-hint">{hint}</span> : null}
        </div>
        {onClear ? (
          <button type="button" className="dashboard-filters-clear" onClick={onClear}>
            <FiX aria-hidden="true" />
            {clearLabel}
          </button>
        ) : null}
      </div>
      <div className="dashboard-filters-body">{children}</div>
    </section>
  );
}
