// RSC shell — fetches people server-side; all CRUD stays in the client island.
// S05.a migration: was 453L 'use client'; now RSC + PeopleClient island.
import { fetchEngine } from "@/lib/fetch-engine";
import { PeopleClient, type Person } from "@/components/modules/workspace/people/people-client";

export default async function PeoplePage() {
  // Best-effort: engine may be temporarily unavailable; empty list is recoverable
  // via the Re-seed button in the client island.
  let initialPeople: Person[] = [];
  try {
    const data = await fetchEngine<Person[]>("/api/engine/seo/people");
    initialPeople = Array.isArray(data) ? data : [];
  } catch {
    // Engine unreachable — client island renders empty list with seed button
  }

  return <PeopleClient initialPeople={initialPeople} />;
}
