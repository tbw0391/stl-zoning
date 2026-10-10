"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { addTodo } from "@/app/todo/actions";

export default function SuggestButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const submit = (fd: FormData) =>
    startTransition(async () => {
      await addTodo(fd);
      formRef.current?.reset();
      setSent(true);
      setTimeout(() => { setSent(false); setOpen(false); }, 1200);
    });

  return (
    <div className="suggest">
      <button type="button" className="link" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Suggest
      </button>
      {open && (
        <form ref={formRef} action={submit} className="suggest-pop card">
          <label htmlFor="suggest-body">Add a suggestion to the to-do list</label>
          <textarea id="suggest-body" name="body" rows={3} required autoFocus placeholder="What should be added or fixed?" />
          <input type="hidden" name="page" value={pathname} />
          <div className="suggest-actions">
            {sent ? <span className="small muted">Added.</span> : <span className="small muted">From {pathname}</span>}
            <button type="submit" disabled={pending}>{pending ? "Adding…" : "Add"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
