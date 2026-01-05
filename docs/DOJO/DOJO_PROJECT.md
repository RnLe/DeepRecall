# Dojo Project Description

## 1. Goals & constraints (recap)

**Primary goals**

- Make **problem solving** (not just flashcards) the central object.
- Support **efficient learning** (retrieval, spacing, interleaving, worked examples, metacognition).
- Support **two modes**:
  - Lightweight, daily “maintenance” / spaced mode.
  - Heavy, focused “cram / deep dive” mode.

- Provide **gamified but meaningful metrics** (no fluff, metrics _are_ the game).
- Model **topics/concepts and their dependencies as a graph**, so you can:
  - Visualize a brick wall / graph.
  - Recommend exercises based on conceptual neighbourhoods.

**Tech constraints**

- Frontend: **Next.js + React** (already in DeepRecall).
- Data: **Postgres + ElectricSQL** (offline-first in the future).
- Language for logic: **TypeScript** (domain + backend).
- This module should:
  - Live **inside the existing web repo**, but
  - Be architected so it can be used standalone or as a “sub-app” of DeepRecall.

- Rust: maybe later for SRS or heavy computation, but not needed for v1.

---

## 2. High-level architecture

Think in **layers**, not in “one monolith”.

### 2.1 Layer overview

1. **Domain layer (pure TS)**
   - Defines all core types and pure functions.
   - No React, no Electric, no HTTP.
   - Can be imported by UI and backend.

2. **Data / repository layer**
   - Adapters for persisting domain objects in Postgres/Electric.
   - Abstract interfaces (`ExerciseRepository`, etc.) and concrete impls.

3. **UI / application layer**
   - React components and pages:
     - Dashboard, Solve Screen, Brick Wall, Authoring UI, Session Summary.

   - Talks to repositories via hooks/services.

4. **Integration layer (DeepRecall host)**
   - Binds this module to:
     - Auth / user IDs.
     - Existing document/annotation/board IDs.

You can do this as a small “vertical slice” inside your existing monorepo:

```text
apps/
  web/                  # your DeepRecall Next.js app
packages/
  dojo-domain/          # pure TS domain logic
  dojo-data/            # repository interfaces + Electric/Postgres bindings
  dojo-ui/              # React components for dojo
```

Later, `apps/web` imports from `dojo-ui` and `dojo-domain`, `dojo-data`.

---

## 3. Domain model & graph

### 3.1 Core entities

Let’s keep the mental model concrete. Core entities:

- **ConceptNode** – a concept or topic (“Symmetric matrix”, “Inner product”, “Eigenvalues of Hermitian operator”).
- **ExerciseTemplate** – a reusable, author-defined problem (with subtasks, hints, solutions, variants).
- **ExerciseVariant** – a specific instantiation of a template (e.g. particular matrix parameters).
- **Attempt** – a single user’s work on one exercise (or variant).
- **SubtaskAttempt** – per-subtask details.
- **Session** – a time-bounded block of work (normal or cram).
- **BrickState / Metrics** – aggregated per-(user, concept/exercise) stats.
- **SchedulerItem** – “this exercise should resurface at time t, in this mode”.

Plus **graph**:

- Concept nodes, edges (dependency / “requires” relationships).
- Exercises are attached to one or more concept nodes.

### 3.2 Relationships (high-level)

- A `ConceptNode`:
  - belongs to a **domain** (Linear Algebra, Analysis…),
  - has edges to prerequisites (`prerequisites: ConceptNode[]`),
  - has edges to dependents via reverse lookups.

- An `ExerciseTemplate`:
  - targets **1–N** concepts (primary + supporting),
  - belongs to **one** domain (for filtering),
  - has emphasis tags (`calculation`, `conceptual`, `proof`, etc.).

- An `ExerciseVariant`:
  - belongs to one `ExerciseTemplate`,
  - can be generated dynamically or pre-specified.

- An `Attempt`:
  - belongs to one **user** and one **exercise** (template or variant),
  - may be part of one `Session`.

- `BrickState`:
  - keyed by `(userId, conceptId)` and/or `(userId, exerciseTemplateId)`.

Graphically:

```text
ConceptNode <---> ConceptNode (prerequisites)
   ^  ^
   |  └─────────+ (multiple prerequisites)
   |
ExerciseTemplate --(targets)--> ConceptNode(s)
   |
ExerciseVariant
   |
Attempt --(aggregated into)--> BrickState
```

### 3.3 TypeScript domain types (sketch)

These would live in `packages/dojo-domain/src/types.ts`:

```ts
export type DomainId =
  | "linear-algebra"
  | "analysis"
  | "mechanics"
  | "em"
  | "qm"
  | string;

export interface ConceptNodeIdBrand {
  _brand: "ConceptNodeId";
}
export type ConceptNodeId = string & ConceptNodeIdBrand;

export interface ExerciseTemplateIdBrand {
  _brand: "ExerciseTemplateId";
}
export type ExerciseTemplateId = string & ExerciseTemplateIdBrand;

export interface ExerciseVariantIdBrand {
  _brand: "ExerciseVariantId";
}
export type ExerciseVariantId = string & ExerciseVariantIdBrand;

export interface UserIdBrand {
  _brand: "UserId";
}
export type UserId = string & UserIdBrand;

export type DifficultyLevel = "intro" | "core" | "advanced";
export type ImportanceLevel = "fundamental" | "supporting" | "nice-to-have";

export interface ConceptNode {
  id: ConceptNodeId;
  domainId: DomainId;
  name: string;
  slug: string;
  description?: string;
  difficulty: DifficultyLevel;
  importance: ImportanceLevel;

  // Graph structure
  prerequisiteIds: ConceptNodeId[]; // edges pointing "downwards"
  tagIds?: string[]; // e.g. 'linear-operator', 'inner-product'

  // For DeepRecall integration later:
  relatedAnnotationIds?: string[];
  relatedDocumentIds?: string[];
  relatedBoardIds?: string[];
}

export type ExerciseTag =
  | "calculation"
  | "conceptual"
  | "definition"
  | "proof"
  | "error-analysis"
  | "multiple-choice";

export interface ExerciseSubtask {
  id: string;
  label?: string; // (a), (b), etc.
  prompt: string; // markdown / LaTeX
  hintSteps?: string[]; // ordered hints
  solutionSketch?: string; // short sketch
  fullSolution?: string; // full worked solution
}

export interface ExerciseTemplate {
  id: ExerciseTemplateId;
  domainId: DomainId;
  title: string;
  description?: string;
  conceptIds: ConceptNodeId[];
  difficulty: DifficultyLevel;
  importance: ImportanceLevel;
  tags: ExerciseTag[];

  subtasks: ExerciseSubtask[];

  // Variant generation: simple for now
  isParameterized: boolean;
  parameterSchema?: any; // later: zod schema
  variantGenerationNote?: string;

  relatedAnnotationIds?: string[];
  relatedDocumentIds?: string[];
  relatedBoardIds?: string[];
}

export interface ExerciseVariant {
  id: ExerciseVariantId;
  templateId: ExerciseTemplateId;
  parameterValues?: any;
  generatedAt: string;
}
```

Attempts and metrics:

```ts
export type AttemptMode = "normal" | "cram" | "exam-sim";
export type AttemptType = "original" | "redo" | "variant";

export type SubtaskResult =
  | "correct"
  | "partially-correct"
  | "incorrect"
  | "skipped";

export interface SubtaskAttempt {
  subtaskId: string;
  result: SubtaskResult;
  selfRatedDifficulty?: number; // 1-5
  errorTypes?: string[]; // e.g. ['algebra', 'concept', 'careless']
}

export interface ExerciseAttempt {
  id: string;
  userId: UserId;
  templateId: ExerciseTemplateId;
  variantId?: ExerciseVariantId;
  mode: AttemptMode;
  attemptType: AttemptType;

  startedAt: string;
  endedAt: string;
  totalSeconds: number;

  subtaskAttempts: SubtaskAttempt[];
  notes?: string;
  attachmentIds?: string[]; // links to uploaded images of handwritten work
}

export interface Session {
  id: string;
  userId: UserId;
  mode: AttemptMode; // 'normal' or 'cram' or 'exam-sim'
  startedAt: string;
  endedAt?: string;
  targetConceptIds?: ConceptNodeId[];
  attemptIds: string[];
  reflectionNote?: string;
}

export interface BrickMastery {
  masteryScore: number; // 0-100
  stabilityScore: number; // how consistent performance is
  avgAccuracy: number; // 0-1
  medianTimeSeconds?: number;
  bestTimeSeconds?: number;
  lastPracticedAt?: string;
  totalAttempts: number;
  totalVariants: number;
  cramSessionsCount: number;
}

export interface ConceptBrickState {
  id: string;
  userId: UserId;
  conceptId: ConceptNodeId;
  metrics: BrickMastery;
}

export interface ExerciseBrickState {
  id: string;
  userId: UserId;
  templateId: ExerciseTemplateId;
  metrics: BrickMastery;
}

export interface SchedulerItem {
  id: string;
  userId: UserId;
  templateId: ExerciseTemplateId;
  scheduledFor: string;
  reason: "initial" | "review" | "cram-followup";
  recommendedMode: AttemptMode;
}
```

### 3.4 Concept graph semantics

Graph semantics:

- Edge `A -> B` means: **A requires B** (B is prerequisite).
  So in the wall view:
  - Prerequisites are “below”.
  - Edges go downward.

- You want:
  - Acyclic graph (DAG) **per domain**.
  - Cross-domain links allowed (e.g. “Fourier series” in Analysis depends on “inner product spaces” in LA).

Important: you do **not** need perfect graph at start. Start with:

- A small domain like **intro linear algebra**.
- 10–30 nodes.
- Reasonable but incomplete prerequisites.

As you build exercises, refine dependencies.

---

## 4. Learning logic: mastery, scheduling, modes

This is where learning science gets translated into concrete logic.

### 4.1 Mastery & metrics

Basic idea:

- Combine **accuracy**, **time**, and **recency** into a `masteryScore`.
- Use **stabilityScore** to capture consistency (variance of performance).
- Use **cramSessionsCount** as a cosmetic bonus.

Example of a pure function in `dojo-domain`:

```ts
export function updateBrickMastery(
  previous: BrickMastery | undefined,
  newAttempts: ExerciseAttempt[]
): BrickMastery {
  // 1. Combine all attempts, or just incremental ones.
  // 2. Compute accuracy per attempt from subtaskResults.
  // 3. Compute rolling median time, best time.
  // 4. Weight recent attempts more for masteryScore.
  // 5. Compute stability as inverse of performance variance.
  // ...
  return {
    masteryScore: /* ... */,
    stabilityScore: /* ... */,
    avgAccuracy: /* ... */,
    medianTimeSeconds: /* ... */,
    bestTimeSeconds: /* ... */,
    lastPracticedAt: /* ... */,
    totalAttempts: /* ... */,
    totalVariants: /* ... */,
    cramSessionsCount: previous?.cramSessionsCount ?? 0,
  };
}
```

A simple heuristic to start:

- `accuracyScore` = weighted average of recent accuracies (subtask-based).
- `speedScore` = how often recent times fall into a **personal target band**:
  - Only computed once there are enough attempts.

- `masteryScore` ≈ `0.7 * accuracyScore + 0.3 * speedScore`.

### 4.2 Scheduling (pre-SRS)

Before a full SRS algorithm, use simple rules:

- On each correct attempt:
  - If this is one of the first 3 attempts:
    - schedule in 1 day.

  - If stable and accurate:
    - schedule in 3–7 days.

- On incorrect attempts:
  - schedule in 1 day, plus offer immediate redo + variant now.

Pure function:

```ts
export function proposeNextReviews(
  userId: UserId,
  attempt: ExerciseAttempt,
  brick: ExerciseBrickState | undefined
): SchedulerItem[] {
  // Use rules above to produce 0, 1 or more scheduler items.
}
```

Later you can swap this with a more principled SRS model without changing UI.

### 4.3 Modes: normal vs cram vs exam-sim

**normal:**

- Short sessions (10–30 minutes).
- Mix of:
  - Already scheduled reviews (from `SchedulerItem`s).
  - A small number of new items if the graph has gaps near important concepts.

**cram:**

- User picks:
  - Duration (e.g. 90 min).
  - Target concept(s) / bricks.

- System suggests:
  - A sequence of “intensive practice” items for these bricks (original + variants).

- After session:
  - log a **cram session**.
  - add follow-up `SchedulerItem`s.

**exam-sim:**

- Not required for v0, but supported by types.
- Later: fixed-length tests.

---

## 5. UI/UX flows & components

### 5.1 Learner view

Key screens:

1. **Training Dashboard**
2. **Solve Screen**
3. **Brick Wall / Concept Graph**
4. **Session Summary**

#### 5.1.1 Training Dashboard

Shows:

- Today’s agenda:
  - Scheduled reviews (from `SchedulerItem`).
  - Suggested new exercises (based on concept graph & mastery).

- Quick stats:
  - Streak (days with >N minutes).
  - Total focus time this week.
  - “Most improved brick” (recent mastery jumps).

- Buttons:
  - “Start normal session” (auto picks from agenda).
  - “Start cram session” (user picks target).

#### 5.1.2 Solve Screen

Central piece; must be excellent.

Contents:

- **Header:** exercise title, tags, linked concepts badges.

- **Timer:**
  - Starts on entry; pause allowed.
  - Shows elapsed time; no big countdown stress for normal mode.

- **Problem area:**
  - Problem statement (LaTeX, etc.).
  - Subtasks (a), (b), … each collapsible for hints & solutions.

- **Interactions:**
  - User marks each subtask result: correct / partial / incorrect.
  - User can:
    - Open hints (tiered).
    - Reveal solution (subtask or whole problem).

  - Upload image(s) of handwritten work.
  - Optional quick self-rating: difficulty, confusion.

- **Finish panel (after user clicks “done”):**
  - Show:
    - Their time vs personal history for this exercise (or type).
    - A simple message: “this was [easy/ok/hard] for you historically”.

  - Offer paths:
    1. “Redo now” (same variant).
    2. “Try similar problem” (variant).
    3. “Back to dashboard / next suggested exercise”.

Data stored:

- An `ExerciseAttempt` with subtask results, times, notes, attachments.

#### 5.1.3 Brick Wall / Concept Graph

- Visual layout:
  - Concepts shown as bricks / nodes.
  - Y-axis roughly = “prerequisite depth”, thanks to DAG level layout.

- Visual encoding:
  - Color = masteryScore (red → yellow → green).
  - Saturation = importance (fundamental brighter).
  - Thin golden border = at least one cram session targeted this brick.
  - Small icon or ribbon for high stabilityScore.

- Interactions:
  - Click a brick → detail sidebar:
    - Description, dependencies, attached exercises.
    - Quick actions:
      - “Practice this brick” (a small session focused here).
      - “View related notes / textbook sections” (DeepRecall integration later).

### 5.2 Authoring view

For you (and maybe future users) to create **ConceptNodes** and **ExerciseTemplates**.

Screens:

1. Concept graph editor.
2. Exercise editor.

#### 5.2.1 Concept graph editor

- List view:
  - Table of concepts with name, domain, difficulty, importance.

- Graph view:
  - DAG visualizer.
  - Drag-drop or form-based editing of prerequisites.

- Editing fields:
  - Name, domain, difficulty.
  - Prerequisite selection from autocomplete.
  - Links to docs/annotations (manual ID input for now, or selection from a simple list if integrated).

#### 5.2.2 Exercise editor

- Fields:
  - Title, domain, tags, difficulty, importance.
  - Assigned concepts (one “primary”, other “supporting”).
  - Subtasks with:
    - Prompt (markdown).
    - Hints list.
    - Solution sketch & full solution.

  - Variant section:
    - For now: just mark `isParameterized` and add `variantGenerationNote` (logic can stay manual initially).

  - Related resources:
    - Document/annotation/board IDs as free-form text.

- Preview:
  - Right side shows how Solve Screen will render.

---

## 6. Data / repository layer with Postgres + Electric

You want the domain layer to be storage-agnostic, but you already know the real backend is Postgres with ElectricSQL.

### 6.1 Minimal DB schema (high-level)

Tables (simplified):

- `dojo_concept_nodes`
- `dojo_exercise_templates`
- `dojo_exercise_variants`
- `dojo_exercise_attempts`
- `dojo_subtask_attempts`
- `dojo_sessions`
- `dojo_concept_bricks`
- `dojo_exercise_bricks`
- `dojo_scheduler_items`

Example: `dojo_concept_nodes`:

```sql
CREATE TABLE dojo_concept_nodes (
  id                uuid PRIMARY KEY,
  domain_id         text NOT NULL,
  name              text NOT NULL,
  slug              text NOT NULL UNIQUE,
  description       text,
  difficulty        text NOT NULL,
  importance        text NOT NULL,
  prerequisite_ids  uuid[] NOT NULL DEFAULT '{}'::uuid[],
  tag_ids           text[] NOT NULL DEFAULT '{}'::text[],
  related_annotation_ids text[] NOT NULL DEFAULT '{}'::text[],
  related_document_ids   text[] NOT NULL DEFAULT '{}'::text[],
  related_board_ids      text[] NOT NULL DEFAULT '{}'::text[]
);
```

`dojo_exercise_templates`:

```sql
CREATE TABLE dojo_exercise_templates (
  id                  uuid PRIMARY KEY,
  domain_id           text NOT NULL,
  title               text NOT NULL,
  description         text,
  concept_ids         uuid[] NOT NULL DEFAULT '{}'::uuid[],
  difficulty          text NOT NULL,
  importance          text NOT NULL,
  tags                text[] NOT NULL DEFAULT '{}'::text[],
  subtasks_json       jsonb NOT NULL,
  is_parameterized    boolean NOT NULL DEFAULT false,
  parameter_schema    jsonb,
  variant_generation_note text,
  related_annotation_ids text[] NOT NULL DEFAULT '{}'::text[],
  related_document_ids   text[] NOT NULL DEFAULT '{}'::text[],
  related_board_ids      text[] NOT NULL DEFAULT '{}'::text[]
);
```

Attempts:

```sql
CREATE TABLE dojo_exercise_attempts (
  id             uuid PRIMARY KEY,
  user_id        uuid NOT NULL,
  template_id    uuid NOT NULL REFERENCES dojo_exercise_templates(id),
  variant_id     uuid,
  mode           text NOT NULL,
  attempt_type   text NOT NULL,
  started_at     timestamptz NOT NULL,
  ended_at       timestamptz NOT NULL,
  total_seconds  integer NOT NULL,
  notes          text,
  attachment_ids text[] NOT NULL DEFAULT '{}'::text[]
);

CREATE TABLE dojo_subtask_attempts (
  id              uuid PRIMARY KEY,
  attempt_id      uuid NOT NULL REFERENCES dojo_exercise_attempts(id) ON DELETE CASCADE,
  subtask_id      text NOT NULL,
  result          text NOT NULL,
  self_difficulty integer,
  error_types     text[] NOT NULL DEFAULT '{}'::text[]
);
```

You can tweak details later; key is: _keep JSON only where structure is nested (subtasks)_, otherwise prefer structured columns.

### 6.2 Electric integration

Later, `dojo-data` will:

- Provide repository interfaces:

```ts
export interface ConceptRepository {
  getConceptById(id: ConceptNodeId): Promise<ConceptNode | null>;
  listConceptsByDomain(domainId: DomainId): Promise<ConceptNode[]>;
  saveConcept(concept: ConceptNode): Promise<void>;
}
```

- And provide Electric-backed implementations:

```ts
export class ElectricConceptRepository implements ConceptRepository {
  constructor(private db: ElectricClient) {}

  async getConceptById(id: ConceptNodeId): Promise<ConceptNode | null> {
    const row = await this.db.dojo_concept_nodes.findFirst({ where: { id } });
    return row ? mapRowToConcept(row) : null;
  }

  // ... etc.
}
```

But you don’t need to implement this now; just define the interfaces so UI code only talks to repositories, not directly to Electric.

---

## 7. Incremental build plan (what to do first)

Given the complexity, a pragmatic sequence:

### Phase 1 – Foundation

- Implement `dojo-domain`:
  - Core types (`ConceptNode`, `ExerciseTemplate`, `ExerciseAttempt`, etc.).
  - Basic metrics logic (`updateBrickMastery`, etc.).

- Create minimal DB schema and migrations for:
  - `dojo_concept_nodes`
  - `dojo_exercise_templates`
  - `dojo_exercise_attempts`
  - `dojo_subtask_attempts`

- Implement simple Node/Next API routes (or server actions) to:
  - CRUD concepts & exercises.
  - Save attempts.

At this point you can hardcode concept data or seed manually.

### Phase 2 – Solve Screen & manual sessions

- Build `dojo-ui` components:
  - `<SolveScreen>` with:
    - Problem display.
    - Timer.
    - Subtask result marking.
    - Hint/solution reveals.

  - Minimal “Start an exercise” list page.

- Wire attempts to DB and metrics computation.

Focus: **single exercise flow** is smooth and pleasant.

### Phase 3 – BrickWall & Dashboard

- Implement BrickWall view:
  - Read concept graph and BrickState (computed on server for now) and render.

- Implement Training Dashboard:
  - Show “recommended next” (simple heuristics).
  - Show some metrics.

### Phase 4 – Sessions & cram

- Add `Session` tracking:
  - Starting/stopping sessions.
  - Mark cram vs normal.

- UI for:
  - Starting a cram session on chosen bricks.
  - Summary screen for finished sessions.

### Phase 5 – Basic scheduler

- Implement `SchedulerItem`s and simple scheduling heuristic.
- Modify dashboard to:
  - First show due items from scheduler.
  - Then suggest new items.

Phase 6+ – DeepRecall integration, SRS, more advanced analytics.

---

## 8. Pitfalls & mitigations

### 8.1 Content authoring overhead

**Risk:** rich templated exercises are expensive to create.

Mitigation:

- Start with a **single micro-domain**, e.g.:
  - Domain: `linear-algebra`.
  - Scope: “2×2 and 3×3 matrices, eigenvalues/eigenvectors, symmetric matrices”.

- Define:
  - ~10–20 concepts.
  - ~10 exercises, each with 1–3 subtasks.

- Use these to validate UX and metrics before scaling.

### 8.2 Over-architecting early

**Risk:** getting lost in perfect domain model and UI components instead of shipping a minimal working slice.

Mitigation:

- The first target: **Solve Screen + one domain + simple dashboard**.
- Keep concept graph small and hand-crafted at first.
- Keep scheduling very simple; design the interface but not the final SRS logic.

### 8.3 Graph complexity & correctness

**Risk:** concept graph becomes messy / inconsistent; recommendations become weird.

Mitigation:

- Define a **graph hygiene checklist**:
  - No cycles (per domain).
  - Each fundamental concept should have `importance = 'fundamental'`.
  - Each exercise must have at least one concept with `importance >= supporting`.

- Add tools:
  - Graph view that highlights cycles.
  - Diagnostics page (later).

### 8.4 Electric/DB complexity

**Risk:** Electric-specific details leaking into domain / UI.

Mitigation:

- Keep domain types **pure**.
- Keep repository interfaces stable.
- Constrain Electric-specific logic to `dojo-data`.

---

## 9. Implementation Checklist

### Phase 1 – Foundation (`@deeprecall/dojo-core`)

#### Types & Domain Model

- [x] Branded ID types (ConceptNodeId, ExerciseTemplateId, etc.)
- [x] Domain enums (DomainId, DifficultyLevel, ExerciseTag, AttemptMode, etc.)
- [x] ConceptNode & ConceptGraph types
- [x] ExerciseTemplate, ExerciseSubtask, ExerciseVariant types
- [x] ExerciseAttempt, SubtaskAttempt types
- [x] Session types
- [x] BrickMastery, ConceptBrickState, ExerciseBrickState types
- [x] SchedulerItem, DailyAgenda, LearningPath types

#### Zod Schemas

- [x] Validation schemas for all domain types

#### Domain Logic (Pure Functions)

- [x] Mastery computation (updateBrickMastery, computeAccuracy, etc.)
- [x] Scheduling logic (proposeNextReviews, computeNextInterval, etc.)
- [x] Graph utilities (topologicalSort, detectCycles, getAncestors, etc.)

#### Repository Interfaces

- [x] ConceptRepository, ConceptBrickRepository
- [x] ExerciseTemplateRepository, ExerciseVariantRepository, ExerciseBrickRepository
- [x] AttemptRepository
- [x] SessionRepository, SessionPlannerRepository
- [x] SchedulerItemRepository, SchedulerConfigRepository, DailyAgendaRepository

#### Utilities

- [x] ID generation functions
- [x] Date/time utilities
- [x] Helper functions (groupBy, keyBy, normalizeSubtasks, etc.)

### Phase 1 – Foundation (Database & Data Layer)

#### DB Schema / Migrations (`migrations/010_dojo_schema.sql`)

- [x] `dojo_concept_nodes` table
- [x] `dojo_exercise_templates` table
- [x] `dojo_exercise_variants` table
- [x] `dojo_exercise_attempts` table
- [x] `dojo_subtask_attempts` table
- [x] `dojo_sessions` table
- [x] `dojo_concept_bricks` table
- [x] `dojo_exercise_bricks` table
- [x] `dojo_scheduler_items` table
- [x] Row-Level Security policies
- [x] Indexes for common queries

#### Repository Implementations (`@deeprecall/dojo-data`)

- [x] Package structure (`packages/dojo-data/`)
- [x] Database row types (`src/types/rows.ts`)
- [x] Mappers (DB rows <-> domain types) (`src/mappers/domain.ts`)
- [x] Electric read hooks (`src/repos/*.electric.ts`)
- [x] Write operations via WriteBuffer (`src/repos/*.electric.ts`)
- [x] Type alignment with dojo-core
- [x] Electric/Postgres implementations (working)
- [x] Local (Dexie) implementations for offline support
- [x] Merged/sync layer

#### Database Migrations Updates

- [x] Migration 012: Initial enum fix
- [x] Migration 013: Align CHECK constraints with dojo-core types

### Phase 2 – Solve Screen & Manual Sessions

#### UI Components (`@deeprecall/dojo-ui`)

- [x] `<SolveScreen>` component
- [x] Problem display with LaTeX rendering
- [x] Timer component
- [x] Subtask result marking UI
- [x] Hint/solution reveal UI
- [x] Exercise list/selection page

#### API Routes / Server Actions

- [x] CRUD for concepts
- [x] CRUD for exercises
- [x] Save attempts
- [x] Compute and save brick states

### Phase 3 – BrickWall & Dashboard

- [x] BrickWall visualization component
- [x] BrickNode individual concept brick
- [x] DAG layout algorithm (topological levels)
- [x] Training Dashboard
- [x] Recommended exercises display (AgendaList)
- [x] Quick stats display (StatsCard, StreakDisplay)
- [x] Session cards (SessionCard)

### Phase 4 – Sessions & Cram Mode

- [x] Session tracking (start/stop) — `useSessionManager` hook
- [x] Cram session UI — `CramSessionSetup`, `ActiveSessionBar`, `SessionCompleteModal`
- [x] Session summary screen — `SessionSummaryScreen`
- [x] Cram badge tracking — Golden ring + Sparkles icon on BrickNode

### Phase 5 – Scheduler Integration

- [x] SchedulerItem persistence — `scheduler.electric.ts` with Electric sync + WriteBuffer
- [x] Dashboard shows due items first — `useScheduler` hook with `computePriority`, enhanced `AgendaList` with priority sorting and overdue badges
- [x] Suggest new items based on graph — `useConceptSuggestions` hook using `graph.ts` utilities

### Phase 6+ – Future

- [ ] DeepRecall integration (annotations, documents, boards)
- [ ] Advanced SRS algorithm
- [ ] Exam simulation mode
- [ ] Analytics dashboard
- [ ] Content authoring tools
