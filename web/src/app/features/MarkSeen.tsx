"use client";

import { useEffect } from "react";
import { markFeaturesSeen } from "./actions";

// Clears the Features badge once the tab has been opened (cookies can only be set from an action, not while rendering).
export default function MarkSeen({ unseen }: { unseen: number }) {
  useEffect(() => { if (unseen > 0) markFeaturesSeen(); }, [unseen]);
  return null;
}
