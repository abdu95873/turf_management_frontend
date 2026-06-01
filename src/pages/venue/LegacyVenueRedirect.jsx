import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { getVenuePath } from "../../lib/venueUrls";

export default function LegacyVenueRedirect() {
  const { resourceId = "" } = useParams();

  const query = useQuery({
    queryKey: ["venue-legacy-redirect", resourceId],
    enabled: Boolean(resourceId),
    queryFn: () => api(`/api/resources/${resourceId}`),
  });

  if (query.isLoading) {
    return (
      <main className="mx-auto max-w-[1180px] px-4 py-10 md:px-6">
        <p className="text-slate-500">Loading venue...</p>
      </main>
    );
  }

  if (query.data?.resource) {
    return <Navigate to={getVenuePath(query.data.resource)} replace />;
  }

  return <Navigate to="/discover" replace />;
}
