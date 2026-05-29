import SlotCheckingPanel from "../../../components/slot-checking/SlotCheckingPanel";
import { DashboardPage } from "../shared/PageChrome";

export default function SlotCheckingModulePage() {
  return (
    <DashboardPage
      title="Slot Checking"
      subtitle="Pick a venue and date to review open, booked, and blocked slots at a glance."
    >
      <SlotCheckingPanel />
    </DashboardPage>
  );
}
