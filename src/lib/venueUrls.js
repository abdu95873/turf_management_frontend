/** Paths reserved for app routes — cannot be used as venue URLs */
export const RESERVED_VENUE_SLUGS = new Set([
  "about",
  "account",
  "admin",
  "api",
  "auth",
  "categories",
  "company",
  "contact",
  "discover",
  "events",
  "health",
  "home",
  "login",
  "owner",
  "payment",
  "register",
  "register-owner",
  "staff",
  "user",
  "venue",
]);

export function normalizeVenueUrlInput(value) {
  const base = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 48);
  return base.length >= 3 ? base : "";
}

export function slugifyVenueName(name) {
  return normalizeVenueUrlInput(name);
}

export function isReservedVenueSlug(slug) {
  return RESERVED_VENUE_SLUGS.has(String(slug || "").toLowerCase());
}

export function getVenuePath(resource) {
  if (resource?.slug) {
    return `/${resource.slug}`;
  }
  if (resource?._id) {
    return `/venue/${resource._id}`;
  }
  return "/discover";
}

export function getVenuePublicUrl(resource) {
  if (typeof window === "undefined") {
    return getVenuePath(resource);
  }
  const base = window.location.origin.replace(/\/$/, "");
  return `${base}${getVenuePath(resource)}`;
}
