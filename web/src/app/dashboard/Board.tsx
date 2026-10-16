"use client";

import { useState, useTransition } from "react";
import { moveProject } from "@/app/projects/actions";

export type BoardColumn = { stage: string; header: React.ReactNode; cards: { id: number; node: React.ReactNode }[] };

// The dashboard pipeline with drag-and-drop: drag a card up or down to reorder it, or into another column to change
// its stage. The new order shows at once and is saved for everyone. Uses the browser's built-in dragging, so it
// works with a mouse; on touch screens the stage dropdown on /projects still changes stages.
export default function Board({ columns }: { columns: BoardColumn[] }) {
  const nodes = new Map(columns.flatMap((c) => c.cards.map((k) => [k.id, k.node] as const)));
  const initial = Object.fromEntries(columns.map((c) => [c.stage, c.cards.map((k) => k.id)]));
  // Reset to the server's order whenever it changes (after a save, or someone else's move).
  const serverKey = JSON.stringify(initial);
  const [state, setState] = useState({ key: serverKey, order: initial });
  const order = state.key === serverKey ? state.order : initial;

  const [dragging, setDragging] = useState<number | null>(null);
  const [drop, setDrop] = useState<{ stage: string; index: number } | null>(null);
  const [, start] = useTransition();

  // Where in the column the pointer is: before the first card whose middle is below it.
  const indexAt = (col: HTMLElement, y: number) => {
    const cards = [...col.querySelectorAll<HTMLElement>("[data-card]")].filter((el) => Number(el.dataset.card) !== dragging);
    const i = cards.findIndex((el) => { const r = el.getBoundingClientRect(); return y < r.top + r.height / 2; });
    return i === -1 ? cards.length : i;
  };

  const finish = (stage: string, index: number) => {
    if (dragging == null) return;
    const next = Object.fromEntries(Object.entries(order).map(([s, ids]) => [s, ids.filter((id) => id !== dragging)]));
    next[stage] = [...next[stage].slice(0, index), dragging, ...next[stage].slice(index)];
    const unchanged = JSON.stringify(next) === JSON.stringify(order);
    setState({ key: serverKey, order: next });
    setDragging(null);
    setDrop(null);
    if (!unchanged) start(() => moveProject(dragging, stage, next[stage]));
  };

  return (
    <div className="pipeline">
      {columns.map((c) => {
        const ids = order[c.stage] ?? [];
        return (
          <section key={c.stage} className={`pipeline-col${drop?.stage === c.stage ? " drop-target" : ""}`}
            onDragOver={(e) => { if (dragging == null) return; e.preventDefault(); setDrop({ stage: c.stage, index: indexAt(e.currentTarget, e.clientY) }); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop(null); }}
            onDrop={(e) => { e.preventDefault(); finish(c.stage, indexAt(e.currentTarget, e.clientY)); }}>
            {c.header}
            {ids.length === 0 && <div className="pipeline-empty small muted">{dragging != null ? "Drop here" : "None"}</div>}
            {ids.map((id) => {
              const before = drop?.stage === c.stage && drop.index === ids.filter((x) => x !== dragging).indexOf(id) && id !== dragging;
              return (
                <div key={id} data-card={id} draggable className={`board-card${dragging === id ? " dragging" : ""}${before ? " drop-before" : ""}`}
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(id)); setDragging(id); }}
                  onDragEnd={() => { setDragging(null); setDrop(null); }}>
                  {nodes.get(id)}
                </div>
              );
            })}
            {drop?.stage === c.stage && drop.index >= ids.filter((x) => x !== dragging).length && ids.length > 0 && <div className="drop-end" />}
          </section>
        );
      })}
    </div>
  );
}
