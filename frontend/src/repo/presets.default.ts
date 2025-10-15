/**
 * Default system presets
 * Pre-configured templates for common work types
 */

import type { Preset } from "@/src/schema/presets";
import { v4 as uuidv4 } from "uuid";

const now = new Date().toISOString();

/**
 * Research Paper preset
 */
export const PAPER_PRESET: Preset = {
  id: uuidv4(),
  kind: "preset",
  name: "Research Paper",
  description: "Academic research paper or conference publication",
  icon: "FileText",
  color: "#3b82f6",
  targetEntity: "work",
  isSystem: true,
  coreFieldConfig: {
    title: { required: true, helpText: "Full paper title" },
    subtitle: { required: false },
    authors: { required: true, helpText: "Paper authors" },
    workType: { required: true, defaultValue: "paper", hidden: true },
    topics: { required: false, helpText: "Research topics/keywords" },
  },
  customFields: [
    {
      key: "abstract",
      label: "Abstract",
      type: "textarea",
      required: false,
      placeholder: "Paper abstract or summary...",
      helpText: "Brief summary of the paper",
      validation: { maxLength: 5000 },
      group: "Content",
      order: 0,
    },
    {
      key: "doi",
      label: "DOI",
      type: "url",
      required: false,
      placeholder: "10.1234/example",
      helpText: "Digital Object Identifier",
      validation: { url: true },
      group: "Identifiers",
      order: 1,
    },
    {
      key: "venue",
      label: "Venue/Conference",
      type: "text",
      required: false,
      placeholder: "NeurIPS, ICML, etc.",
      helpText: "Conference or journal name",
      group: "Publication",
      order: 2,
    },
    {
      key: "citationCount",
      label: "Citation Count",
      type: "number",
      required: false,
      validation: { min: 0 },
      group: "Metrics",
      order: 3,
    },
  ],
  formLayout: "two-column",
  fieldOrder: ["title", "authors", "topics", "abstract", "doi", "venue"],
  createdAt: now,
  updatedAt: now,
};

/**
 * Textbook preset
 */
export const TEXTBOOK_PRESET: Preset = {
  id: uuidv4(),
  kind: "preset",
  name: "Textbook",
  description: "Educational textbook or course book",
  icon: "BookOpen",
  color: "#8b5cf6",
  targetEntity: "work",
  isSystem: true,
  coreFieldConfig: {
    title: { required: true },
    subtitle: { required: false },
    authors: { required: true },
    workType: { required: true, defaultValue: "textbook", hidden: true },
    topics: { required: false, helpText: "Subject areas covered" },
  },
  customFields: [
    {
      key: "isbn",
      label: "ISBN",
      type: "text",
      required: false,
      placeholder: "978-0-123456-78-9",
      helpText: "International Standard Book Number",
      validation: { pattern: "^[0-9\\-]+$" },
      group: "Identifiers",
      order: 0,
    },
    {
      key: "courseLevel",
      label: "Course Level",
      type: "select",
      required: false,
      helpText: "Target academic level",
      options: [
        { value: "high-school", label: "High School" },
        { value: "undergraduate", label: "Undergraduate" },
        { value: "graduate", label: "Graduate" },
        { value: "advanced", label: "Advanced/PhD" },
      ],
      group: "Academic",
      order: 1,
    },
    {
      key: "prerequisites",
      label: "Prerequisites",
      type: "textarea",
      required: false,
      placeholder: "Required background knowledge...",
      helpText: "What students should know beforehand",
      group: "Academic",
      order: 2,
    },
    {
      key: "difficulty",
      label: "Difficulty Rating",
      type: "select",
      required: false,
      options: [
        { value: "beginner", label: "⭐ Beginner" },
        { value: "intermediate", label: "⭐⭐ Intermediate" },
        { value: "advanced", label: "⭐⭐⭐ Advanced" },
        { value: "expert", label: "⭐⭐⭐⭐ Expert" },
      ],
      group: "Metadata",
      order: 3,
    },
  ],
  formLayout: "two-column",
  fieldOrder: [
    "title",
    "authors",
    "isbn",
    "courseLevel",
    "topics",
    "prerequisites",
  ],
  createdAt: now,
  updatedAt: now,
};

/**
 * Thesis/Dissertation preset
 */
export const THESIS_PRESET: Preset = {
  id: uuidv4(),
  kind: "preset",
  name: "Thesis/Dissertation",
  description: "PhD thesis, Master's thesis, or dissertation",
  icon: "GraduationCap",
  color: "#06b6d4",
  targetEntity: "work",
  isSystem: true,
  coreFieldConfig: {
    title: { required: true },
    subtitle: { required: false },
    authors: { required: true, helpText: "Thesis author (single author)" },
    workType: { required: true, defaultValue: "thesis", hidden: true },
    topics: { required: false, helpText: "Research areas" },
  },
  customFields: [
    {
      key: "thesisType",
      label: "Thesis Type",
      type: "select",
      required: true,
      options: [
        { value: "phd", label: "PhD Dissertation" },
        { value: "masters", label: "Master's Thesis" },
        { value: "bachelor", label: "Bachelor's Thesis" },
        { value: "other", label: "Other" },
      ],
      group: "Academic",
      order: 0,
    },
    {
      key: "institution",
      label: "Institution",
      type: "text",
      required: true,
      placeholder: "University name",
      helpText: "Where the thesis was submitted",
      group: "Academic",
      order: 1,
    },
    {
      key: "department",
      label: "Department",
      type: "text",
      required: false,
      placeholder: "Department of Physics",
      group: "Academic",
      order: 2,
    },
    {
      key: "advisor",
      label: "Advisor",
      type: "text",
      required: false,
      placeholder: "Prof. John Smith",
      helpText: "Primary thesis advisor",
      group: "People",
      order: 3,
    },
    {
      key: "committee",
      label: "Committee Members",
      type: "textarea",
      required: false,
      placeholder: "Prof. A, Prof. B, Dr. C",
      helpText: "Thesis committee members",
      group: "People",
      order: 4,
    },
    {
      key: "defenseDate",
      label: "Defense Date",
      type: "date",
      required: false,
      helpText: "Date of thesis defense",
      group: "Timeline",
      order: 5,
    },
    {
      key: "abstract",
      label: "Abstract",
      type: "textarea",
      required: false,
      placeholder: "Thesis abstract...",
      validation: { maxLength: 10000 },
      group: "Content",
      order: 6,
    },
  ],
  formLayout: "two-column",
  fieldOrder: [
    "title",
    "authors",
    "thesisType",
    "institution",
    "department",
    "advisor",
    "defenseDate",
    "topics",
    "abstract",
  ],
  createdAt: now,
  updatedAt: now,
};

/**
 * Course Notes preset
 */
export const NOTES_PRESET: Preset = {
  id: uuidv4(),
  kind: "preset",
  name: "Course Notes",
  description: "Lecture notes, course materials, or study notes",
  icon: "StickyNote",
  color: "#eab308",
  targetEntity: "work",
  isSystem: true,
  coreFieldConfig: {
    title: { required: true, placeholder: "Course name or topic" },
    subtitle: { required: false },
    authors: { required: false, helpText: "Instructor or note-taker" },
    workType: { required: true, defaultValue: "notes", hidden: true },
    topics: { required: false },
  },
  customFields: [
    {
      key: "courseName",
      label: "Course Name/Number",
      type: "text",
      required: false,
      placeholder: "PHYS 101, CS 224N, etc.",
      group: "Course",
      order: 0,
    },
    {
      key: "semester",
      label: "Semester/Term",
      type: "text",
      required: false,
      placeholder: "Fall 2025",
      group: "Course",
      order: 1,
    },
    {
      key: "instructor",
      label: "Instructor",
      type: "text",
      required: false,
      placeholder: "Prof. Jane Doe",
      group: "Course",
      order: 2,
    },
    {
      key: "completeness",
      label: "Completeness",
      type: "select",
      required: false,
      helpText: "How complete are these notes?",
      options: [
        { value: "draft", label: "📝 Draft/Incomplete" },
        { value: "partial", label: "📄 Partial" },
        { value: "complete", label: "✅ Complete" },
        { value: "reviewed", label: "🌟 Reviewed/Polished" },
      ],
      group: "Status",
      order: 3,
    },
  ],
  formLayout: "single-column",
  fieldOrder: [
    "title",
    "courseName",
    "semester",
    "instructor",
    "topics",
    "completeness",
  ],
  createdAt: now,
  updatedAt: now,
};

/**
 * All default system presets
 */
export const DEFAULT_PRESETS: Preset[] = [
  PAPER_PRESET,
  TEXTBOOK_PRESET,
  THESIS_PRESET,
  NOTES_PRESET,
];
