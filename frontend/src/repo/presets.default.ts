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
  name: "Paper",
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
  name: "Thesis",
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
 * Script preset (lecture scripts, course materials)
 */
export const SCRIPT_PRESET: Preset = {
  id: uuidv4(),
  kind: "preset",
  name: "Script",
  description: "Lecture script, course materials, or teaching notes",
  icon: "FileText",
  color: "#10b981",
  targetEntity: "work",
  isSystem: true,
  coreFieldConfig: {
    title: { required: true, placeholder: "Script or course name" },
    subtitle: { required: false },
    authors: { required: false, helpText: "Instructor or author" },
    workType: { required: true, defaultValue: "notes", hidden: true },
    topics: { required: false },
  },
  customFields: [
    {
      key: "courseCode",
      label: "Course Code",
      type: "text",
      required: false,
      placeholder: "PHYS 101, MATH 201, etc.",
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
      key: "institution",
      label: "Institution",
      type: "text",
      required: false,
      placeholder: "University name",
      group: "Course",
      order: 2,
    },
    {
      key: "lectureNumber",
      label: "Lecture Number",
      type: "text",
      required: false,
      placeholder: "Lecture 1, Week 3, etc.",
      group: "Content",
      order: 3,
    },
  ],
  formLayout: "single-column",
  fieldOrder: [
    "title",
    "courseCode",
    "semester",
    "institution",
    "lectureNumber",
    "topics",
  ],
  createdAt: now,
  updatedAt: now,
};

/**
 * Slides preset (presentation slides)
 */
export const SLIDES_PRESET: Preset = {
  id: uuidv4(),
  kind: "preset",
  name: "Slides",
  description: "Presentation slides, talk, or seminar",
  icon: "Presentation",
  color: "#f59e0b",
  targetEntity: "work",
  isSystem: true,
  coreFieldConfig: {
    title: { required: true, placeholder: "Presentation title" },
    subtitle: { required: false },
    authors: { required: false, helpText: "Presenter or speaker" },
    workType: { required: true, defaultValue: "slides", hidden: true },
    topics: { required: false },
  },
  customFields: [
    {
      key: "event",
      label: "Event/Conference",
      type: "text",
      required: false,
      placeholder: "Conference name, seminar series, etc.",
      group: "Context",
      order: 0,
    },
    {
      key: "date",
      label: "Presentation Date",
      type: "date",
      required: false,
      helpText: "When the presentation was given",
      group: "Context",
      order: 1,
    },
    {
      key: "location",
      label: "Location",
      type: "text",
      required: false,
      placeholder: "City, venue, or online",
      group: "Context",
      order: 2,
    },
    {
      key: "duration",
      label: "Duration",
      type: "text",
      required: false,
      placeholder: "30 min, 1 hour, etc.",
      helpText: "Presentation length",
      group: "Metadata",
      order: 3,
    },
    {
      key: "videoUrl",
      label: "Video Recording",
      type: "url",
      required: false,
      placeholder: "https://...",
      helpText: "Link to recorded presentation",
      validation: { url: true },
      group: "Resources",
      order: 4,
    },
  ],
  formLayout: "two-column",
  fieldOrder: ["title", "authors", "event", "date", "location", "topics"],
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
  SCRIPT_PRESET,
  SLIDES_PRESET,
];

/**
 * Default preset names for easy lookup
 */
export const DEFAULT_PRESET_NAMES = [
  "Paper",
  "Textbook",
  "Thesis",
  "Script",
  "Slides",
] as const;
