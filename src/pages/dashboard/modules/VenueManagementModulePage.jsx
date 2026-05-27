import { useAuth } from "../../../context/AuthContext";
import AdminVenuesSection from "../admin/AdminVenuesSection";
import OwnerResourcesPanel from "../owner/OwnerResourcesPanel";
import { DashboardPage } from "../shared/PageChrome";

export default function VenueManagementModulePage() {
  const { user } = useAuth();

  return (
    <DashboardPage
      title="Venue Management"
      subtitle={
        user?.role === "admin"
          ? "View all venues and set per-venue commission rates"
          : user?.role === "staff"
            ? "Set minimum booking amounts and generate bookable time slots"
            : "Create venues, set pricing, and generate bookable time slots"
      }
    >
      {user?.role === "admin" ? <AdminVenuesSection /> : <OwnerResourcesPanel />}
    </DashboardPage>
  );
}
