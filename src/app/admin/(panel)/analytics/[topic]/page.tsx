import { notFound } from "next/navigation";
import { snapshot } from "@/lib/analytics";
import { Detail } from "./Detail";
import { TOPICS } from "./topics";

export const dynamic = "force-dynamic";
export default async function AnalyticsTopic({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  if (!(topic in TOPICS)) notFound();
  return <Detail topic={topic} initial={snapshot(7)} />;
}
