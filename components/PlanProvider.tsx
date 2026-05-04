"use client";

import { createContext, useContext } from "react";

interface PlanContextValue {
  plan:        string;
  planExpiry?: string;
  /** true when on "demo" free tier — all create/mutate actions are blocked */
  isDemo:      boolean;
  /** true when demo_plus is active (not expired) */
  isDemoPlus:  boolean;
  /** true when pro plan is active */
  isPro:       boolean;
}

const PlanContext = createContext<PlanContextValue>({
  plan:       "demo",
  isDemo:     true,
  isDemoPlus: false,
  isPro:      false,
});

export function PlanProvider({
  plan,
  planExpiry,
  children,
}: {
  plan:        string;
  planExpiry?: string;
  children:    React.ReactNode;
}) {
  const isExpired = plan === "demo_plus" && (!planExpiry || new Date(planExpiry) <= new Date());
  const value: PlanContextValue = {
    plan,
    planExpiry,
    // Block data entry on free demo OR expired demo+ — server enforces the same rule
    isDemo:    plan === "demo" || isExpired,
    isDemoPlus: plan === "demo_plus" && !isExpired,
    isPro:     plan === "pro",
  };
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

/** Returns the current subscription plan context for the active shop. */
export function usePlan() {
  return useContext(PlanContext);
}
