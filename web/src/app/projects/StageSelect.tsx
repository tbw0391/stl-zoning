"use client";

import { useTransition } from "react";
import { STAGE_LABEL } from "@/lib/format";
import { setStage } from "./actions";

// Suggestion #26: change a project's stage straight from the list; saves as soon as a stage is picked.
export default function StageSelect({ id, stage }: { id: number; stage: string }) {
  const [pending, start] = useTransition();
  return (
    <select className={`stage-select stage-${stage}`} defaultValue={stage} disabled={pending} aria-label="Stage"
      onChange={(e) => { const v = e.target.value; start(() => setStage(id, v)); }}>
      {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}
