import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FiMapPin, FiPlus, FiSave } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { api, authHeaders } from "../../../lib/api";
import {
  Alert,
  Badge,
  Button,
  DashboardCard,
  EmptyState,
  Field,
  FormGrid,
  Input,
  Select,
  StatCard,
  StatGrid,
} from "../shared/PageChrome";

const RESOURCE_TYPES = [
  { value: "turf", label: "Football / Turf" },
  { value: "pool", label: "Swimming / Pool" },
  { value: "sports", label: "Multi-Sport" },
];

function canManageResource(resource, user) {
  if (!resource || !user) return false;
  if (user.role === "admin") return true;
  if (user.role === "owner") return String(resource.ownerId) === String(user.id);
  if (user.role === "staff" && user.ownerId) return String(resource.ownerId) === String(user.ownerId);
  return false;
}

export default function OwnerResourcesPanel() {
  const { token, user } = useAuth();
  const isOwner = user?.role === "owner";
  const isStaff = user?.role === "staff";
  const canCreateVenue = isOwner;

  const [message, setMessage] = useState("");
  const [activeResourceId, setActiveResourceId] = useState("");
  const [slotDate, setSlotDate] = useState(new Date().toISOString().slice(0, 10));
  const [settingsForm, setSettingsForm] = useState({
    pricePerHour: "",
    minimumBookingAmount: "",
  });
  const [resourceForm, setResourceForm] = useState({
    name: "",
    type: "turf",
    locationName: "",
    latitude: "23.8103",
    longitude: "90.4125",
    facilities: "parking, lights, changing room",
    pricePerHour: "1200",
    minimumBookingAmount: "0",
    imageUrl: "",
    isActive: true,
  });
  const [slotForm, setSlotForm] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    startTime: "06:00",
    endTime: "23:00",
    durationMinutes: "60",
  });

  const resourcesQuery = useQuery({
    queryKey: ["venue-resources", user?.role, user?.id, user?.ownerId],
    queryFn: () => api("/api/resources"),
  });

  const manageableResources = useMemo(() => {
    return (resourcesQuery.data ?? []).filter((resource) => canManageResource(resource, user));
  }, [resourcesQuery.data, user]);

  const slotsQuery = useQuery({
    queryKey: ["owner-slots", activeResourceId, slotDate],
    enabled: Boolean(activeResourceId && slotDate),
    queryFn: () => api(`/api/slots?resourceId=${activeResourceId}&date=${slotDate}`),
  });

  const activeResource = manageableResources.find((resource) => resource._id === activeResourceId) ?? null;
  const availableSlots = (slotsQuery.data ?? []).filter((slot) => slot.status === "available").length;
  const bookedSlots = (slotsQuery.data ?? []).filter((slot) => slot.status === "booked").length;

  useEffect(() => {
    if (!activeResource) return;
    setSettingsForm({
      pricePerHour: String(activeResource.pricePerHour ?? ""),
      minimumBookingAmount: String(activeResource.minimumBookingAmount ?? 0),
    });
  }, [activeResource]);

  const createResourceMutation = useMutation({
    mutationFn: () =>
      api("/api/resources", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          name: resourceForm.name.trim(),
          type: resourceForm.type,
          locationName: resourceForm.locationName.trim(),
          latitude: Number(resourceForm.latitude),
          longitude: Number(resourceForm.longitude),
          facilities: resourceForm.facilities.split(",").map((item) => item.trim()).filter(Boolean),
          images: resourceForm.imageUrl.trim() ? [resourceForm.imageUrl.trim()] : [],
          pricePerHour: Number(resourceForm.pricePerHour),
          minimumBookingAmount: Number(resourceForm.minimumBookingAmount) || 0,
          isActive: resourceForm.isActive,
        }),
      }),
    onSuccess: () => {
      setMessage("Venue created successfully.");
      resourcesQuery.refetch();
      setResourceForm((current) => ({
        ...current,
        name: "",
        locationName: "",
        imageUrl: "",
      }));
    },
    onError: (error) => setMessage(error.message),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: () => {
      const payload = {
        minimumBookingAmount: Number(settingsForm.minimumBookingAmount) || 0,
      };
      if (isOwner) {
        payload.pricePerHour = Number(settingsForm.pricePerHour) || 0;
      }
      return api(`/api/resources/${activeResourceId}/settings`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setMessage("Venue pricing settings saved.");
      resourcesQuery.refetch();
    },
    onError: (error) => setMessage(error.message),
  });

  const generateSlotsMutation = useMutation({
    mutationFn: () =>
      api("/api/slots/generate", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          resourceId: activeResourceId,
          startDate: slotForm.startDate,
          endDate: slotForm.endDate,
          startTime: slotForm.startTime,
          endTime: slotForm.endTime,
          durationMinutes: Number(slotForm.durationMinutes),
        }),
      }),
    onSuccess: (data) => {
      const days = data.daysProcessed ?? 1;
      setMessage(`Generated ${data.createdCount ?? 0} slots across ${days} day(s).`);
      setSlotDate(slotForm.startDate);
      slotsQuery.refetch();
    },
    onError: (error) => setMessage(error.message),
  });

  return (
    <>
      {message ? <Alert tone={message.includes("success") || message.includes("Generated") || message.includes("saved") ? "success" : "info"}>{message}</Alert> : null}

      <StatGrid>
        <StatCard
          label={isStaff ? "Assigned Venues" : "My Venues"}
          value={manageableResources.length}
          hint="Active listings"
          icon={FiMapPin}
          tone="accent"
        />
        <StatCard label="Selected Venue" value={activeResource?.name ?? "—"} hint="Currently managing" />
        <StatCard label="Available Slots" value={activeResourceId ? availableSlots : "—"} hint={slotDate} tone="success" />
        <StatCard label="Booked Slots" value={activeResourceId ? bookedSlots : "—"} hint={slotDate} tone="warning" />
      </StatGrid>

      <div className={`dashboard-split ${canCreateVenue ? "" : "dashboard-split-single"}`}>
        {canCreateVenue ? (
          <DashboardCard title="Add New Venue" description="Create a turf, pool, or sports venue for bookings.">
            <FormGrid columns={2}>
              <Field label="Venue name" htmlFor="res-name" required>
                <Input
                  id="res-name"
                  value={resourceForm.name}
                  onChange={(event) => setResourceForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Golden Arena Turf"
                />
              </Field>
              <Field label="Category" htmlFor="res-type" required>
                <Select
                  id="res-type"
                  value={resourceForm.type}
                  onChange={(event) => setResourceForm((current) => ({ ...current, type: event.target.value }))}
                >
                  {RESOURCE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Location" htmlFor="res-location" required className="dashboard-field-span-2">
                <Input
                  id="res-location"
                  value={resourceForm.locationName}
                  onChange={(event) => setResourceForm((current) => ({ ...current, locationName: event.target.value }))}
                  placeholder="Gulshan, Dhaka"
                />
              </Field>
              <Field label="Latitude" htmlFor="res-lat">
                <Input
                  id="res-lat"
                  value={resourceForm.latitude}
                  onChange={(event) => setResourceForm((current) => ({ ...current, latitude: event.target.value }))}
                />
              </Field>
              <Field label="Longitude" htmlFor="res-lng">
                <Input
                  id="res-lng"
                  value={resourceForm.longitude}
                  onChange={(event) => setResourceForm((current) => ({ ...current, longitude: event.target.value }))}
                />
              </Field>
              <Field label="Price per hour (BDT)" htmlFor="res-price" required>
                <Input
                  id="res-price"
                  type="number"
                  min="0"
                  value={resourceForm.pricePerHour}
                  onChange={(event) => setResourceForm((current) => ({ ...current, pricePerHour: event.target.value }))}
                />
              </Field>
              <Field label="Minimum booking (BDT)" htmlFor="res-min" hint="Lowest amount accepted per booking">
                <Input
                  id="res-min"
                  type="number"
                  min="0"
                  value={resourceForm.minimumBookingAmount}
                  onChange={(event) => setResourceForm((current) => ({ ...current, minimumBookingAmount: event.target.value }))}
                />
              </Field>
              <Field label="Cover image URL" htmlFor="res-image" hint="Optional — shown on discover pages">
                <Input
                  id="res-image"
                  value={resourceForm.imageUrl}
                  onChange={(event) => setResourceForm((current) => ({ ...current, imageUrl: event.target.value }))}
                  placeholder="https://..."
                />
              </Field>
              <Field label="Facilities" htmlFor="res-facilities" className="dashboard-field-span-2">
                <Input
                  id="res-facilities"
                  value={resourceForm.facilities}
                  onChange={(event) => setResourceForm((current) => ({ ...current, facilities: event.target.value }))}
                  placeholder="parking, lights, shower"
                />
              </Field>
            </FormGrid>
            <label className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={resourceForm.isActive}
                onChange={(event) => setResourceForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              Venue is active and visible to customers
            </label>
            <div className="mt-5">
              <Button onClick={() => createResourceMutation.mutate()} disabled={createResourceMutation.isPending}>
                <FiPlus />
                {createResourceMutation.isPending ? "Saving..." : "Create venue"}
              </Button>
            </div>
          </DashboardCard>
        ) : null}

        <DashboardCard
          title={isStaff ? "Owner Venues" : "Your Venues"}
          description={isStaff ? "Select a venue to set minimum booking and generate slots." : "Select a venue to manage time slots."}
        >
          {resourcesQuery.isLoading ? <p className="text-sm text-slate-500">Loading venues...</p> : null}
          {!resourcesQuery.isLoading && !manageableResources.length ? (
            <EmptyState
              title="No venues yet"
              description={isStaff ? "Your owner has not assigned any venues yet." : "Create your first venue using the form on the left."}
            />
          ) : (
            <ul className="space-y-2">
              {manageableResources.map((resource) => (
                <li key={resource._id}>
                  <button
                    type="button"
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      activeResourceId === resource._id
                        ? "border-ds-primary bg-ds-primary/5"
                        : "border-slate-200 bg-slate-50 hover:border-ds-primary/40"
                    }`}
                    onClick={() => setActiveResourceId(resource._id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-ds-secondary">{resource.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{resource.locationName}</p>
                      </div>
                      <Badge size="sm" tone={resource.isActive ? "success" : "neutral"} className="w-fit shrink-0">
                        {resource.isActive ? "Active" : "Hidden"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-ds-primary">
                      {resource.pricePerHour} BDT / hr · min {resource.minimumBookingAmount ?? 0} BDT · {resource.type}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>

      {activeResource ? (
        <DashboardCard title="Pricing settings" description={`Minimum booking and hourly rate for ${activeResource.name}`}>
          <FormGrid columns={2}>
            {isOwner ? (
              <Field label="Price per hour (BDT)" htmlFor="settings-price">
                <Input
                  id="settings-price"
                  type="number"
                  min="0"
                  value={settingsForm.pricePerHour}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, pricePerHour: event.target.value }))}
                />
              </Field>
            ) : null}
            <Field label="Minimum booking amount (BDT)" htmlFor="settings-min" hint="Bookings below this amount will be rejected">
              <Input
                id="settings-min"
                type="number"
                min="0"
                value={settingsForm.minimumBookingAmount}
                onChange={(event) => setSettingsForm((current) => ({ ...current, minimumBookingAmount: event.target.value }))}
              />
            </Field>
          </FormGrid>
          <div className="mt-4">
            <Button onClick={() => updateSettingsMutation.mutate()} disabled={updateSettingsMutation.isPending}>
              <FiSave />
              {updateSettingsMutation.isPending ? "Saving..." : "Save pricing settings"}
            </Button>
          </div>
        </DashboardCard>
      ) : null}

      <DashboardCard
        title="Slot generator"
        description={activeResource ? `Generate slots for ${activeResource.name}` : "Select a venue first"}
      >
        <FormGrid columns={3}>
          <Field label="Start date" htmlFor="slot-start-date">
            <Input
              id="slot-start-date"
              type="date"
              value={slotForm.startDate}
              onChange={(event) => {
                const value = event.target.value;
                setSlotForm((current) => ({
                  ...current,
                  startDate: value,
                  endDate: current.endDate < value ? value : current.endDate,
                }));
                setSlotDate(value);
              }}
              disabled={!activeResourceId}
            />
          </Field>
          <Field label="End date" htmlFor="slot-end-date" hint="Same day or multi-day range">
            <Input
              id="slot-end-date"
              type="date"
              min={slotForm.startDate}
              value={slotForm.endDate}
              onChange={(event) => setSlotForm((current) => ({ ...current, endDate: event.target.value }))}
              disabled={!activeResourceId}
            />
          </Field>
          <Field label="Slot duration (minutes)" htmlFor="slot-duration">
            <Input
              id="slot-duration"
              type="number"
              min="15"
              step="15"
              value={slotForm.durationMinutes}
              onChange={(event) => setSlotForm((current) => ({ ...current, durationMinutes: event.target.value }))}
              disabled={!activeResourceId}
            />
          </Field>
          <Field label="Start time" htmlFor="slot-start">
            <Input
              id="slot-start"
              type="time"
              value={slotForm.startTime}
              onChange={(event) => setSlotForm((current) => ({ ...current, startTime: event.target.value }))}
              disabled={!activeResourceId}
            />
          </Field>
          <Field label="End time" htmlFor="slot-end">
            <Input
              id="slot-end"
              type="time"
              value={slotForm.endTime}
              onChange={(event) => setSlotForm((current) => ({ ...current, endTime: event.target.value }))}
              disabled={!activeResourceId}
            />
          </Field>
        </FormGrid>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => generateSlotsMutation.mutate()} disabled={!activeResourceId || generateSlotsMutation.isPending}>
            Generate slots
          </Button>
        </div>

        {activeResourceId ? (
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <p className="text-sm font-bold text-ds-secondary">Preview slots</p>
              <Input
                type="date"
                className="max-w-[180px]"
                value={slotDate}
                onChange={(event) => setSlotDate(event.target.value)}
              />
            </div>
            {slotsQuery.isLoading ? (
              <p className="text-sm text-slate-500">Loading slots...</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(slotsQuery.data ?? []).map((slot) => (
                  <span
                    key={slot._id}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                      slot.status === "available"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-slate-100 text-slate-600"
                    }`}
                  >
                    {slot.startTime}–{slot.endTime} · {slot.status}
                  </span>
                ))}
                {!slotsQuery.data?.length ? <p className="text-sm text-slate-500">No slots for this date. Generate above.</p> : null}
              </div>
            )}
          </div>
        ) : null}
      </DashboardCard>
    </>
  );
}
