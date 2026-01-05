# Dojo Domain Types

> Quick reference for all domain types in `@deeprecall/dojo-core`.

## Enums & Literals

```ts
// Knowledge domains
type DomainId = "linear-algebra" | "analysis" | "mechanics" | "quantum-mechanics" | ...

// Classification
type DifficultyLevel = "intro" | "core" | "advanced";
type ImportanceLevel = "fundamental" | "supporting" | "enrichment";

// Exercise categorization
type ExerciseTag = "calculation" | "conceptual" | "proof" | "derivation" | ...

// Attempt context
type AttemptMode = "normal" | "cram" | "exam-sim";
type AttemptType = "original" | "redo" | "variant";
type SubtaskResult = "correct" | "partially-correct" | "incorrect" | "skipped";

// Error analysis
type ErrorType = "algebra" | "concept" | "careless" | "sign" | "units" | ...
```

---

## Core Entities

### ConceptNode

```ts
interface ConceptNode {
  id: ConceptNodeId;
  domainId: DomainId;
  name: string; // "Eigenvalues of Hermitian Operators"
  slug: string; // "eigenvalues-hermitian-operators"
  description?: string;
  difficulty: DifficultyLevel;
  importance: ImportanceLevel;
  prerequisiteIds: ConceptNodeId[]; // Graph edges
  tagIds?: string[];
  createdAt: string;
  updatedAt: string;
}
```

### ExerciseTemplate

```ts
interface ExerciseTemplate {
  id: ExerciseTemplateId;
  domainId: DomainId;
  title: string;
  problemStatement?: string; // Main problem text (LaTeX)
  subtasks: ExerciseSubtask[]; // (a), (b), (c)...
  primaryConceptIds: ConceptNodeId[];
  supportingConceptIds?: ConceptNodeId[];
  difficulty: DifficultyLevel;
  importance: ImportanceLevel;
  tags: ExerciseTag[];
  isParameterized: boolean; // Can generate variants?
  parameterSchema?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ExerciseSubtask {
  id: SubtaskId;
  label?: string; // "(a)", "Part 1"
  prompt: string; // Subtask question
  hintSteps?: string[]; // Progressive hints
  solutionSketch?: string;
  fullSolution?: string;
}
```

### ExerciseAttempt

```ts
interface ExerciseAttempt {
  id: AttemptId;
  userId: UserId;
  templateId: ExerciseTemplateId;
  variantId?: ExerciseVariantId;
  sessionId?: SessionId;
  mode: AttemptMode;
  attemptType: AttemptType;
  startedAt: string;
  endedAt: string;
  totalSeconds: number;
  subtaskAttempts: SubtaskAttempt[];
  completionStatus: "completed" | "abandoned" | "in-progress";
  accuracy?: number; // Computed: 0-1
}

interface SubtaskAttempt {
  subtaskId: SubtaskId;
  result: SubtaskResult;
  selfRatedDifficulty?: number; // 1-5
  errorTypes?: ErrorType[];
  usedHints?: boolean;
  revealedSolution?: boolean;
}
```

### BrickMastery

```ts
interface BrickMastery {
  masteryScore: number; // 0-100 (composite score)
  stabilityScore: number; // 0-100 (consistency)
  avgAccuracy: number; // 0-1
  medianTimeSeconds: number | null;
  bestTimeSeconds: number | null;
  lastPracticedAt: string | null;
  totalAttempts: number;
  totalVariants: number;
  cramSessionsCount: number;
  correctStreak: number;
  trend: "improving" | "stable" | "declining" | "new";
  masteredAt: string | null; // When score first hit 70+
}
```

### SchedulerItem

```ts
interface SchedulerItem {
  id: SchedulerItemId;
  userId: UserId;
  templateId: ExerciseTemplateId;
  scheduledFor: string; // ISO datetime
  reason: "initial" | "review" | "cram-followup" | "error-recovery";
  recommendedMode: AttemptMode;
  priority: number; // Higher = more urgent
  completed: boolean;
}
```

---

## Type Helpers

```ts
// Create inputs (without generated fields)
type ConceptNodeCreate = Omit<ConceptNode, "id" | "createdAt" | "updatedAt">;
type ExerciseTemplateCreate = Omit<
  ExerciseTemplate,
  "id" | "createdAt" | "updatedAt"
>;

// Update inputs (partial + required id)
type ConceptNodeUpdate = Partial<ConceptNodeCreate> & { id: ConceptNodeId };
```

---

## Constants

```ts
import {
  DIFFICULTY_LEVELS, // ["intro", "core", "advanced"]
  EXERCISE_TAGS, // ["calculation", "conceptual", ...]
  EMPTY_BRICK_MASTERY, // Default empty mastery object
  DEFAULT_SCHEDULER_CONFIG,
} from "@deeprecall/dojo-core";
```
