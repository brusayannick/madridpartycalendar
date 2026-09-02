import { CalendarView } from "@/components/calendar-view";
import type { EventRow } from "@/lib/events";
import { fetchUpcomingEvents, hasSupabaseEnv } from "@/lib/supabase";
import sampleEvents from "@/lib/sample-events.json";

// Refresh the page data every 5 minutes (crawlers run separately).
export const revalidate = 300;

export default async function Page() {
  let events: EventRow[];
  let demo = false;

  if (hasSupabaseEnv()) {
    try {
      events = await fetchUpcomingEvents();
    } catch (error) {
      console.error("Supabase fetch failed, falling back to sample data:", error);
      events = sampleEvents as EventRow[];
      demo = true;
    }
  } else {
    // No Supabase configured yet — render the crawler snapshot so the app
    // works out of the box (see README for setup).
    events = sampleEvents as EventRow[];
    demo = true;
  }

  return <CalendarView events={events} demo={demo} />;
}
