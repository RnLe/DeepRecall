"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { MeepProject } from "@/app/types/meepStudio/strapi/meepProjectTypes";

type Tab = MeepProject;
interface Ctx {
  tabs: Tab[];
  activeId: string | null;
  openTab: (p: Tab) => void;
  closeTab: (id: string) => void;
  selectTab: (id: string) => void;
}
const StudioTabsContext = createContext<Ctx | null>(null);
export const useStudioTabs = () => useContext(StudioTabsContext)!;

export const StudioTabsProvider = ({ children }: { children: ReactNode }) => {
  const [tabs, setTabs]       = useState<Tab[]>([]);
  const [activeId, setActive] = useState<string | null>(null);

  const openTab = (p: Tab) => {
    setTabs((t) => (t.find((x) => x.documentId === p.documentId) ? t : [...t, p]));
    setActive(p.documentId!);
  };
  const closeTab = (id: string) => {
    setTabs((t) => t.filter((x) => x.documentId !== id));
    setActive((a) => (a === id ? null : a));
  };

  const value: Ctx = { tabs, activeId, openTab, closeTab, selectTab: setActive };
  return <StudioTabsContext.Provider value={value}>{children}</StudioTabsContext.Provider>;
};
