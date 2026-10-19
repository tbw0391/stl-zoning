"use client";

import { createContext, useContext } from "react";

// Hands the switched-on features (read from the cookie in the layout) to client components.
const FeaturesContext = createContext<string[]>([]);

export default function FeaturesProvider({ on, children }: { on: string[]; children: React.ReactNode }) {
  return <FeaturesContext.Provider value={on}>{children}</FeaturesContext.Provider>;
}

export const useFeature = (key: string) => useContext(FeaturesContext).includes(key);
