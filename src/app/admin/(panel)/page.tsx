import { snapshot } from "@/lib/analytics";
import { hubStats } from "@/lib/hub";
import { Hub } from "./Hub";

export const dynamic = "force-dynamic";
export default function AdminHome() {
  return <Hub initial={{ ...snapshot(7), hub: hubStats() }} />;
}
