"use client";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import {
  DayTemplate,
  TimeBlock,
  createDayTemplate,
  createTimeBlock,
  addTimeBlockToDayTemplate,
  modifyTimeBlockTimes
} from "@/app/types/planner/dayTemplateTypes";

type WithoutId<T> = Omit<T, "id">;

type PlannerState = {
  dayTemplates: DayTemplate[];
  selectedDayTemplateId: string | null;
  selectDayTemplate: (id: string | null) => void;
  addDayTemplate: (name: string, description?: string) => void;
  removeDayTemplate: (id: string) => void;
  updateDayTemplate: (id: string, partial: Partial<DayTemplate>) => void;
  addTimeBlock: (templateId: string, block: WithoutId<TimeBlock>) => void;
  removeTimeBlock: (templateId: string, blockId: string) => void;
  modifyTimeBlock: (
    templateId: string,
    blockId: string,
    newStart: number,
    newEnd: number
  ) => void;
};

export const usePlannerStore = createWithEqualityFn<PlannerState>(
  (set) => ({
    dayTemplates: [],
    selectedDayTemplateId: null,

    selectDayTemplate: (id) => set({ selectedDayTemplateId: id }),

    addDayTemplate: (name, description) =>
      set((s) => ({
        dayTemplates: [...s.dayTemplates, createDayTemplate(name, description)]
      })),

    removeDayTemplate: (id) =>
      set((s) => ({
        dayTemplates: s.dayTemplates.filter((t) => t.id !== id),
        selectedDayTemplateId:
          s.selectedDayTemplateId === id ? null : s.selectedDayTemplateId
      })),

    updateDayTemplate: (id, partial) =>
      set((s) => ({
        dayTemplates: s.dayTemplates.map((t) =>
          t.id === id ? { ...t, ...partial, updatedAt: new Date().toISOString() } : t
        )
      })),

    addTimeBlock: (templateId, blockData) =>
      set((s) => ({
        dayTemplates: s.dayTemplates.map((t) =>
          t.id === templateId
            ? addTimeBlockToDayTemplate(
                t,
                createTimeBlock(
                  blockData.startTime,
                  blockData.endTime,
                  blockData.title,
                  blockData.group,
                  blockData.description
                )
              )
            : t
        )
      })),

    removeTimeBlock: (templateId, blockId) =>
      set((s) => ({
        dayTemplates: s.dayTemplates.map((t) =>
          t.id === templateId
            ? {
                ...t,
                timeBlocks: t.timeBlocks?.filter((b) => b.id !== blockId),
                updatedAt: new Date().toISOString()
              }
            : t
        )
      })),

    modifyTimeBlock: (templateId, blockId, newStart, newEnd) =>
      set((s) => ({
        dayTemplates: s.dayTemplates.map((t) =>
          t.id === templateId
            ? {
                ...t,
                timeBlocks: t.timeBlocks?.map((b) =>
                  b.id === blockId ? modifyTimeBlockTimes(b, newStart, newEnd) : b
                ),
                updatedAt: new Date().toISOString()
              }
            : t
        )
      }))
  }),
  shallow
);
