import { Cockpit } from "./Cockpit";
import { snapshot } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export default function AnalyticsPage() {
  return <Cockpit initial={snapshot(7)} />;
}
