import { Navigate, useParams } from "react-router-dom";
import { isReservedVenueSlug } from "../../lib/venueUrls";
import VenueLandingPage from "./VenueLandingPage";

export default function VenuePublicRoute() {
  const { venueSlug = "" } = useParams();

  if (isReservedVenueSlug(venueSlug)) {
    return <Navigate to="/" replace />;
  }

  return <VenueLandingPage />;
}
