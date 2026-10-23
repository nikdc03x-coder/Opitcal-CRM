import { useState, type ReactNode } from "react";
import { AnalyticsContext, AnalyticsStore } from "./reportStore";

// nik - Each visit owns its report cache; nothing survives leaving Business Analytics.
export function AnalyticsDataProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => new AnalyticsStore());
  return <AnalyticsContext.Provider value={store}>{children}</AnalyticsContext.Provider>;
}
