"use client";

import { pickState } from "@/app/features/actions";

// Header menu for the state the site shows (feature "state-picker"); the choice is a cookie read by lib/state.
export default function StatePicker({ states, current }: { states: Record<string, string>; current: string }) {
  return (
    <select className="state-picker" aria-label="Area" value={current} onChange={(e) => pickState(e.target.value)}>
      {Object.entries(states).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
    </select>
  );
}
