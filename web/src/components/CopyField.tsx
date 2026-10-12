"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faCheck } from "@fortawesome/free-solid-svg-icons";

export default function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-field">
      <input type="text" readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn" onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}>
        <FontAwesomeIcon icon={copied ? faCheck : faCopy} /> {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
