// A watched source needs review when it changed after the last time someone marked it reviewed.
export const needsReview = (w: { last_changed_at: string | null; reviewed_at: string | null }) =>
  !!w.last_changed_at && (!w.reviewed_at || w.reviewed_at < w.last_changed_at);
