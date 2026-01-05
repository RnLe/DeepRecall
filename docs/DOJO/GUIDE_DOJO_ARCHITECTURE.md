# Dojo Module Architecture

> Math/physics problem solving with spaced repetition and mastery tracking.

## Package Structure

```
packages/
├── dojo-core/          # Pure domain layer (types, logic, interfaces)
├── dojo-data/          # Repository implementations (Electric, Dexie) [TODO]
└── dojo-ui/            # React components [TODO]
```

---

## `@deeprecall/dojo-core`

**Pure TypeScript. No React, no DB, no side effects.**

```
src/
├── index.ts            # Main exports
├── types/              # Domain entities
│   ├── ids.ts          # Branded ID types
│   ├── enums.ts        # DomainId, DifficultyLevel, ExerciseTag, etc.
│   ├── concept.ts      # ConceptNode, ConceptGraph
│   ├── exercise.ts     # ExerciseTemplate, ExerciseSubtask, ExerciseVariant
│   ├── attempt.ts      # ExerciseAttempt, SubtaskAttempt
│   ├── session.ts      # Session, SessionSummary, PracticeStreak
│   ├── brick.ts        # BrickMastery, ConceptBrickState, ExerciseBrickState
│   └── scheduler.ts    # SchedulerItem, DailyAgenda, LearningPath
├── schemas/            # Zod validation (mirrors types/)
├── logic/              # Pure functions
│   ├── mastery.ts      # updateBrickMastery, computeAccuracy
│   ├── scheduling.ts   # proposeNextReviews, computeNextInterval
│   └── graph.ts        # topologicalSort, detectCycles, getAncestors
├── repositories/       # Abstract interfaces (no implementations)
└── utils/              # ID generation, dates, helpers
```

### Import Paths

```ts
import { ConceptNode, ExerciseTemplate } from "@deeprecall/dojo-core";
import { updateBrickMastery } from "@deeprecall/dojo-core/logic";
import { ConceptNodeSchema } from "@deeprecall/dojo-core/schemas";
import type { ConceptRepository } from "@deeprecall/dojo-core/repositories";
```

---

## Core Entities

| Entity             | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `ConceptNode`      | Node in knowledge graph (e.g., "Eigenvalues")        |
| `ExerciseTemplate` | Reusable problem with subtasks, hints, solutions     |
| `ExerciseVariant`  | Parameterized instance of a template                 |
| `ExerciseAttempt`  | User's work on one exercise                          |
| `Session`          | Time-bounded practice block                          |
| `BrickMastery`     | Aggregated mastery metrics (score, stability, trend) |
| `SchedulerItem`    | "Review exercise X at time T"                        |

---

## Entity Relationships

```
ConceptNode ←──prerequisites──→ ConceptNode
     ↑
     └── targets ── ExerciseTemplate ── has ──→ ExerciseSubtask[]
                          │
                          └── spawns ──→ ExerciseVariant
                                              │
                                              ↓
                    User ── makes ──→ ExerciseAttempt ── in ──→ Session
                                              │
                                              ↓
                                    aggregates into
                                              │
                              ┌───────────────┴───────────────┐
                              ↓                               ↓
                    ConceptBrickState              ExerciseBrickState
                              │                               │
                              └───────── BrickMastery ────────┘
```

---

## Key Logic Functions

### Mastery (`logic/mastery.ts`)

- `updateBrickMastery(prev, attempts)` → `BrickMastery`
- `computeAttemptAccuracy(subtaskAttempts)` → `number`
- `detectTrend(attempts)` → `"improving" | "stable" | "declining"`

### Scheduling (`logic/scheduling.ts`)

- `proposeNextReviews(userId, attempt, brick)` → `SchedulingProposal[]`
- `computeNextInterval(accuracy, prevInterval, attemptCount)` → `days`

### Graph (`logic/graph.ts`)

- `topologicalSort(nodes)` → `ConceptNode[]`
- `detectCycles(nodes)` → `string[][]`
- `getAncestors(nodes, nodeId)` → `Set<string>`

---

## Branded IDs

Type-safe IDs prevent mixing up different entity types:

```ts
type ConceptNodeId = string & { __brand: "ConceptNodeId" };
type ExerciseTemplateId = string & { __brand: "ExerciseTemplateId" };

// Generate new IDs
const id = generateConceptNodeId(); // "abc123..."

// Cast existing strings
const id = asConceptNodeId("existing-uuid");
```

---

## See Also

- **Full spec**: `/DOJO_PROJECT.md`
- **Data patterns**: `/docs/ARCHITECTURE/GUIDE_DATA_ARCHITECTURE.md`
- **Electric patterns**: `/docs/ARCHITECTURE/GUIDE_ELECTRIC_PATTERN.md`
