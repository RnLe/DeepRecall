# Meaningful Categories for Fields of Science

1. **What “levels” actually exist in math/physics (from the real world).**
2. **A concrete classification model for your system (discipline → area → subarea → concept).**
3. **How to encode that in your existing types (`domain_id`, tags, etc.).**
4. **Edge / relation types and their semantics.**
5. **Content categories (exercise, theorem, statement, etc.).**
6. **2–3 reverse examples to stress-test the scheme.**

---

## 1. What levels exist “out there”?

From the Wikipedia math page, they group math into **“areas of mathematics”** like:

- Number theory
- Geometry
- Algebra
- Calculus and analysis
- Discrete mathematics
- Mathematical logic and set theory
- Statistics and other decision sciences
- Computational mathematics ([Wikipedia][1])

Within each area, there are **sub-areas**: e.g. under Algebra you have group theory, ring theory, linear algebra, representation theory, etc.; under analysis you have real analysis, complex analysis, functional analysis, measure theory, PDEs, Fourier analysis, etc. ([Wikipedia][2])

For physics, Wikipedia’s “Branches of physics” lists e.g. ([Wikipedia][3])

- Classical mechanics
- Thermodynamics and statistical mechanics
- Electromagnetism and photonics
- Relativity
- Quantum mechanics / atomic / molecular physics
- Optics and acoustics
- Condensed matter physics
- High-energy particle & nuclear physics
- Chaos theory
- Cosmology
- Interdisciplinary fields (astro-, geo-, bio-, etc.)

Within each: further sub-fields (Lagrangian mechanics, continuum mechanics, solid-state physics, etc.).

So in the wild, you basically have:

- **Discipline**: mathematics, physics, computer science, etc.
- **Area / branch**: algebra, analysis, classical mechanics, EM, etc.
- **Subarea**: linear algebra, real analysis, point-set topology, Lagrangian mechanics, etc.
- **Topics / concepts**: symmetric matrix, Lebesgue integral, Euler–Lagrange equation, etc.

Your list (“Linear Algebra, Real Analysis, Differentiating Vector-Valued Functions, Point Set Topology, Complex Analysis, Lebesgue Integration, Fourier Analysis, Algorithms, Category Theory, …”) is a _mix_ of **areas**, **sub-areas**, and **topics**:

- **Areas** (roughly level 1): Algebra, Geometry, Analysis, Topology, Algorithms/CS-ish, Category theory (cross-cutting).
- **Subareas** (level 2): Linear algebra (under Algebra), Real Analysis / Complex Analysis (under Analysis), Point-set topology (under Topology), Fourier analysis (under Analysis or Harmonic analysis).
- **Topics** (level 3): Differentiating vector-valued functions (topic in multivariable calculus), Lebesgue integration (topic in measure theory).

That’s why it feels inconsistent: they _are_ at different depths.

---

## 2. A concrete classification model for Dojo

### 2.1 Keep two orthogonal things separate

You really want to separate:

1. **Taxonomy** (tree-ish): discipline → area → subarea.
   This is like a shelf in a library.

2. **Concept graph** (DAG): concepts with prerequisite relations.
   This is the actual dependency structure your brain uses.

They interact, but they’re not the same object.

### 2.2 Proposed levels / names

Let’s give names that are not too overloaded:

- **Discipline** – `math`, `physics`, `cs`, `engineering`, …
- **Area** – major branch inside a discipline (close to Wikipedia “areas” / “branches”).
- **Subarea** – more specific branch.
- **ConceptNode** – your existing node type; each is a single concept/theorem/definition/technique.

So a full classification for a concept is a triple:

```text
discipline / area / subarea
```

Examples:

- `math / algebra / linear-algebra`
- `math / analysis / real-analysis`
- `math / analysis / vector-calculus`
- `math / topology / point-set`
- `physics / classical-mechanics / lagrangian-mechanics`
- `physics / electromagnetism / maxwell-equations`
- `math / logic-and-foundations / category-theory`

Then **ConceptNodes** sit inside that, and the **prerequisite graph** is layered over all of it.

---

## 3. Encode this in your existing types

You already have `domain_id: string` in DB rows. Perfect place to encode the triple in a controlled string format.

### 3.1 Domain ID as a path

Convention (suggestion):

```text
<discipline>.<area>[.<subarea>]
```

Examples:

- `math.algebra.linear-algebra`
- `math.analysis.real-analysis`
- `math.analysis.complex-analysis`
- `math.analysis.fourier-analysis`
- `math.analysis.measure-theory`
- `math.topology.point-set`
- `physics.classical-mechanics.lagrangian`
- `physics.em.maxwell-theory`
- `physics.qm.nonrelativistic`
- `cs.algorithms.graph-algorithms`
- `cs.theory.complexity-theory`
- etc.

**DB stays exactly as it is** (domain_id is just a string); you interpret it in the domain layer:

```ts
// dojo-core

export type DisciplineId = "math" | "physics" | "cs" | "engineering" | "other";

export interface DomainPath {
  discipline: DisciplineId;
  area: string;
  subarea?: string;
}

export function parseDomainId(domainId: string): DomainPath {
  const [discipline, area, subarea] = domainId.split(".");
  const d = (discipline ?? "other") as DisciplineId;
  return {
    discipline: d,
    area: area ?? "misc",
    subarea: subarea,
  };
}

export function makeDomainId(path: DomainPath): string {
  return path.subarea
    ? `${path.discipline}.${path.area}.${path.subarea}`
    : `${path.discipline}.${path.area}`;
}
```

Then:

- For **ConceptNode** and **ExerciseTemplate**, `domain_id` becomes a _strict_ domain path string from this scheme.
- You can later add a small curated mapping like

```ts
export const MATH_AREAS = [
  "number-theory",
  "geometry",
  "algebra",
  "analysis",
  "discrete-mathematics",
  "logic-and-set-theory",
  "statistics",
  "computational-mathematics",
] as const;
```

and for physics similarly from “Branches of physics”. ([Wikipedia][1])

### 3.2 Concept vs. topic vs. “chapter”

I’d recommend:

- **Do not** create special entities for “chapter-level topics” like “Linear Algebra” or “Real Analysis” yet.
- Instead:
  - Represent those as **subareas** in the domain path, or as **fundamental ConceptNodes** with `importance = 'fundamental'` that have many children.

- **Do** use ConceptNodes for the actual _learnable chunks_:
  - “symmetric matrix”
  - “self-adjoint operator on finite-dimensional inner product space”
  - “Lebesgue integral”
  - “line integral of a vector field”
  - …

Your graph will naturally group them: everything under `math.analysis.real-analysis` with importance `fundamental` is the “core of real analysis”; `supporting` nodes are details and standard lemmas; `enrichment` are less central.

---

## 4. Edge / relation types and their semantics

You already store `prerequisite_ids: string[]` in `DojoConceptNodeRow`. That _is_ your main graph.

I’d formalize this in the domain model:

```ts
export type ConceptRelationKind =
  | "prerequisite" // B must be reasonably mastered before A
  | "generalization" // A is a generalization of B
  | "special-case" // A is a special case of B
  | "analogue" // A is an analogue of B in another setting
  | "dual" // e.g. product/sum, contravariant/covariant
  | "equivalent"; // logically equivalent definitions

// For now, only 'prerequisite' is stored structurally in DB.
// Others can be tags / metadata or a future relation table.
```

**Precise semantics for your existing field**:

> `prerequisite_ids` on A is the list of concept IDs B such that
> “B is a prerequisite for A in the sense that a typical learner should understand B before A.”

This gives a DAG (you enforce acyclicity by sanity checking).

If you later want to store other relation kinds, you can add a separate table:

```sql
CREATE TABLE dojo_concept_relations (
  id uuid primary key,
  owner_id uuid not null,
  source_concept_id uuid not null,
  target_concept_id uuid not null,
  kind text not null, -- 'prerequisite', 'analogue', etc.
  created_at timestamptz not null default now()
);
```

…and still treat `prerequisite_ids` as a denormalized shortcut for the main use case.

---

## 5. Content categories: exercise, theorem, statement, etc.

Right now you have **ConceptNodes** and **ExerciseTemplates**. That’s fine, but you’re asking: should there be a “category” field vs. just tags?

I’d absolutely introduce **small enums** for key distinctions that affect UI/logic, and use **tags** for the rest.

### 5.1 Concept kinds

Concepts are not all the same thing. Some are objects, some are properties, some are theorems, some are methods.

Add (logically, domain-layer first; DB column later if useful):

```ts
export type ConceptKind =
  | "object" // e.g. "symmetric matrix", "Hilbert space"
  | "definition" // definition of an object or property
  | "property" // e.g. "symmetric matrices are diagonalizable"
  | "theorem" // e.g. spectral theorem
  | "lemma"
  | "corollary"
  | "axiom"
  | "technique" // "Gaussian elimination", "integration by parts"
  | "heuristic"; // "replace sum by integral", etc.

export interface ConceptNode /* domain */ {
  // ...
  kind: ConceptKind;
}
```

In practice many concepts will be pairs:

- ConceptNode “Symmetric matrix” (kind: `object`).
- ConceptNode “Spectral theorem for real symmetric matrices” (kind: `theorem`).

Both may have exercises attached.

This helps UI:

- The brick wall can show different glyphs for **theorem**, **definition**, **technique**, etc.
- A “Theory mode” could focus on theorems/definitions; a “Practice mode” focuses on exercises.

### 5.2 Exercise kinds

For `ExerciseTemplateRow` you already have `tags: string[]`. I’d standardize a few tags and also carve out an explicit `exercise_kind` (or treat exercise-kind as a reserved tag).

Examples of _kind_ for exercises:

- `'calculation'` – compute something concrete.
- `'concept-check'` – short conceptual questions, definitions, implications.
- `'proof-construction'` – write all or part of a proof.
- `'fill-in-proof'` – guided proof with gaps.
- `'multiple-choice'`.
- `'true-false'`.
- `'error-analysis'` – debug a faulty argument.

The **kind** determines UI:

- Calculation: timer is visible, attachments encouraged, solution hidden but with step-by-step.
- Concept-check: maybe small cards that support quick SRS later.
- Proof-construction: maybe a different UI without strong time pressure, more emphasis on hints.

You can represent this like:

```ts
export type ExerciseKind =
  | "calculation"
  | "concept-check"
  | "proof-construction"
  | "fill-in-proof"
  | "multiple-choice"
  | "true-false"
  | "error-analysis";

export interface ExerciseTemplate {
  // ...
  exerciseKind: ExerciseKind;
  // tags stays as additional flavor:
  // tags: ['undergrad', 'exam-style', 'LA1', ...]
}
```

In DB you can for now just store `exerciseKind` as a string column, or encode it as a reserved tag prefix like `"kind:calculation"` if you want to avoid migrations for the moment.

---

## 6. Reverse examples: classify concrete things

Let’s do exactly what you asked: pick concrete items and classify them all the way down.

### Example 1: Spectral theorem for real symmetric matrices

Say we have:

- Concept: “Spectral theorem for real symmetric matrices”.
- Exercise: “Diagonalize the following symmetric 3×3 matrix and express the quadratic form in principal axes coordinates.”

**Classification**

- **Discipline**: `math`
- **Area**: `algebra`
- **Subarea**: `linear-algebra`
  → `domain_id = "math.algebra.linear-algebra"`

**ConceptNodes involved**

1. Concept: `"Inner product space"`
   - `domain_id = "math.algebra.linear-algebra"`
   - `kind = "object"`
   - `importance = "fundamental"`
   - `prerequisite_ids`: `{ "math.linear-algebra.vector-space", "math.analysis.real-analysis.limits" }` (etc.)

2. Concept: `"Symmetric matrix"`
   - `domain_id = "math.algebra.linear-algebra"`
   - `kind = "object"`
   - `prerequisite_ids`: `["vector-space", "matrix", "transpose"]`

3. Concept: `"Orthogonal matrix"`
   - same domain, kind `object`

4. Concept: `"Spectral theorem for real symmetric matrices"`
   - `domain_id = "math.algebra.linear-algebra"`
   - `kind = "theorem"`
   - `importance = "fundamental"`
   - `prerequisite_ids`: `[ "inner-product-space", "symmetric-matrix", "orthogonal-matrix" ]`

**ExerciseTemplate**

- `title`: "Diagonalize a symmetric 3×3 matrix"
- `domain_id`: `"math.algebra.linear-algebra"`
- `exerciseKind`: `'calculation'`
- `difficulty`: `'core'`
- `importance`: `'supporting'` (practice brick for the theorem)
- `concept_ids`: `[ "spectral-theorem-real-symmetric", "symmetric-matrix" ]`
- maybe `primary_concept_ids = ["spectral-theorem-real-symmetric"]`, `supporting_concept_ids = ["symmetric-matrix"]`.

Now your UI/gears can:

- Show in the brick wall: brick “Spectral theorem…” at some layer, colored by mastery.
- Suggest this exercise when the system wants to practice that brick.

### Example 2: Green’s theorem / planar Stokes

Take: “Green’s theorem for planar vector fields” with a proof/exercise: “Verify Green’s theorem on the unit disk for F(x,y) = (−y, x)”.

**Classification**

- **Discipline**: `math`
- **Area**: `analysis`
- **Subarea**: `vector-calculus` (or `real-analysis` if you want to be less granular)
  - So: `domain_id = "math.analysis.vector-calculus"`

**ConceptNodes**

1. `"Line integral of a vector field"`
   - domain: `"math.analysis.vector-calculus"`
   - kind: `object` or `definition`
   - importance: `fundamental`

2. `"Double integral over a region in R^2"`
   - domain: `"math.analysis.real-analysis"`
   - kind: `definition`
   - importance: `fundamental`

3. `"Green's theorem"`
   - domain: `"math.analysis.vector-calculus"`
   - kind: `theorem`
   - importance: `fundamental`
   - `prerequisite_ids`:
     - `"line-integral-vector-field"`
     - `"double-integral-region"`
     - `"orientation-of-curve"`
     - `"partial-derivative-continuity"` (concept nodes from real analysis)

**ExerciseTemplate**

- `exerciseKind`: `'proof-construction'` or `'calculation'` depending on how you phrase it.
- `concept_ids`: `[ "greens-theorem" ]`
- `difficulty`: `'core'` (for analysis 2)
- `importance`: `'supporting'`
- tags: `['exam-style', 'undergrad-core']`

Here you see clearly:

- The taxonomy says: “this lives in math / analysis / vector-calculus”.
- The _graph_ says: “you must understand line integrals, double integrals, and orientation first”.

### Example 3: Physics – Euler–Lagrange equations for the harmonic oscillator

Item: “Derive the Euler–Lagrange equation for a 1D harmonic oscillator and solve for x(t).”

**Classification**

- **Discipline**: `physics`
- **Area**: `classical-mechanics` ([Wikipedia][3])
- **Subarea**: `lagrangian-mechanics`
  - `domain_id = "physics.classical-mechanics.lagrangian"`

**ConceptNodes**

1. `"Configuration space"`
   - domain: `"physics.classical-mechanics.lagrangian"`
   - kind: `object`
   - prerequisites: `"coordinate-system"`, `"generalized-coordinates"`

2. `"Lagrangian (T − V)"`
   - domain: `"physics.classical-mechanics.lagrangian"`
   - kind: `definition`
   - prerequisites: `"kinetic-energy"`, `"potential-energy"`

3. `"Action functional"`
   - domain: same
   - kind: `definition`
   - prerequisites: `"lagrangian"`, `"definite-integral"`

4. `"Euler–Lagrange equation"`
   - domain: `"physics.classical-mechanics.lagrangian"`
   - kind: `theorem` (or “fundamental equation”)
   - prerequisites: `"action-functional"`, `"variational-derivative"`

5. `"Harmonic oscillator"`
   - domain: maybe `"physics.classical-mechanics.oscillations"`
   - kind: `object` or `example`

**ExerciseTemplate**

- `domain_id = "physics.classical-mechanics.lagrangian"`
- `exerciseKind = "calculation"` with a bit of structured derivation
- `concept_ids = ["euler-lagrange-equation", "harmonic-oscillator"]`
- tags: `['undergrad-mechanics', 'math-methods']`

Again: taxonomy says “classical mechanics / Lagrangian mechanics”; graph says which mathematical/physical concepts are prerequisites.

---

## 7. What this gives you in practice

With this architecture:

- `domain_id` is a **clean, hierarchical bucket** that aligns with how the community already slices knowledge (areas/branches).
- `ConceptNode.kind` and `ExerciseTemplate.exerciseKind` give you **hard categories** that influence UI/logic.
- `prerequisite_ids` and future `ConceptRelationKind` give you a **semantic concept graph** with clear edge meanings.

And crucially:

- You can combine these dimensions easily:
  - _"Show my brick wall for `math.algebra.linear-algebra`, but only theorems of importance = fundamental."_
  - _"Give me all calculation exercises in `physics.classical-mechanics` that directly practice concepts with importance = fundamental and masteryScore < 60."_

---

## 8. Implementation Checklist

### Phase 1: Domain Layer Types (`@deeprecall/dojo-core`)

#### New Types File: `types/domain-taxonomy.ts`

- [x] `DisciplineId` enum type (`"math"`, `"physics"`, `"cs"`, `"engineering"`, `"other"`)
- [x] `DomainPath` interface (`{ discipline, area, subarea? }`)
- [x] `ConceptKind` type (`"object"`, `"definition"`, `"property"`, `"theorem"`, `"lemma"`, `"corollary"`, `"axiom"`, `"technique"`, `"heuristic"`, `"example"`)
- [x] `ExerciseKind` type (`"calculation"`, `"concept-check"`, `"proof-construction"`, `"fill-in-proof"`, `"multiple-choice"`, `"true-false"`, `"error-analysis"`, `"derivation"`, `"application"`)
- [x] `ConceptRelationKind` type (for future: `"prerequisite"`, `"generalization"`, `"special-case"`, `"analogue"`, `"dual"`, `"equivalent"`)
- [x] Constants for known areas per discipline (`MATH_AREAS`, `PHYSICS_AREAS`, `CS_AREAS`)
- [x] Labels for all new enums
- [x] `ExerciseKindBehavior` interface with UI behavior hints

#### New Utils: `utils/domain-path.ts`

- [x] `parseDomainId(domainId: string): DomainPath` — parse `"math.algebra.linear-algebra"` into structured path
- [x] `makeDomainId(path: DomainPath): string` — construct domain ID from path
- [x] `getDiscipline(domainId: string): DisciplineId` — extract discipline
- [x] `getArea(domainId: string): string` — extract area
- [x] `getSubarea(domainId: string): string | undefined` — extract subarea
- [x] `isValidDomainId(domainId: string): boolean` — validate format
- [x] `hasKnownDiscipline(domainId: string): boolean` — check if discipline is known
- [x] `getParentDomain(domainId: string): string | undefined` — get parent domain
- [x] `isDomainAncestor(ancestor, descendant): boolean` — check hierarchy
- [x] `sameDiscipline(domainId1, domainId2): boolean` — check same discipline
- [x] `sameArea(domainId1, domainId2): boolean` — check same area
- [x] `getDomainLabel(domainId: string): string` — human-readable label
- [x] `getShortDomainLabel(domainId: string): string` — short label

#### Update: `types/enums.ts`

- [x] Update `DomainId` type to use hierarchical format (`"<discipline>.<area>[.<subarea>]"`)
- [x] Add `COMMON_DOMAIN_IDS` constant with examples
- [x] Add `LEGACY_DOMAIN_MAPPING` for migration
- [x] Re-export new types from domain-taxonomy

#### Update: `types/concept.ts`

- [x] Add `conceptKind: ConceptKind` field to `ConceptNode`
- [x] Add `conceptKind` to `ConceptNodeCreate` and `ConceptNodeUpdate`

#### Update: `types/exercise.ts`

- [x] Add `exerciseKind: ExerciseKind` field to `ExerciseTemplate`
- [x] Add `exerciseKind` to `ExerciseTemplateCreate`

#### New Schemas: `schemas/domain-taxonomy.ts`

- [x] `DisciplineIdSchema`
- [x] `DomainPathSchema`
- [x] `HierarchicalDomainIdSchema` — regex-validated domain ID
- [x] `ValidatedDomainIdSchema` — with known discipline check
- [x] `ConceptKindSchema`
- [x] `ExerciseKindSchema`
- [x] `ConceptRelationKindSchema`
- [x] Known area schemas (`MathAreaSchema`, `PhysicsAreaSchema`, `CsAreaSchema`)

#### Update: `schemas/concept.ts`

- [x] Add `conceptKind` to concept schemas
- [x] Add `isGlobal` field

#### Update: `schemas/exercise.ts`

- [x] Add `exerciseKind` to exercise schemas
- [x] Add `isGlobal` field

#### Update: `index.ts`

- [x] Export all new types from `types/domain-taxonomy`
- [x] Export all new utils from `utils/domain-path`
- [x] Export all new schemas
- [x] Export `COMMON_DOMAIN_IDS` and `LEGACY_DOMAIN_MAPPING`

### Phase 2: Data Layer (`@deeprecall/dojo-data`)

#### Update: `types/rows.ts`

- [x] Add `DbConceptKind` type
- [x] Add `DbExerciseKind` type
- [x] Add `concept_kind` field to `DojoConceptNodeRow`
- [x] Add `exercise_kind` field to `DojoExerciseTemplateRow`

#### Update: `mappers/domain.ts`

- [x] Map `concept_kind` <-> `conceptKind` for concepts
- [x] Map `exercise_kind` <-> `exerciseKind` for exercises
- [x] Import new types from `@deeprecall/dojo-core` (`ConceptKind`, `ExerciseKind`)
- [x] Import new DB types (`DbConceptKind`, `DbExerciseKind`)

### Phase 3: Database Migration

#### New Migration: `migrations/015_domain_taxonomy.sql`

- [x] Add `concept_kind` column to `dojo_concept_nodes` (with default `'object'` for existing rows)
- [x] Add `exercise_kind` column to `dojo_exercise_templates` (with default `'calculation'` for existing rows)
- [x] Add CHECK constraints for valid enum values
- [x] Create indexes for filtering by kind (`idx_*_kind`, `idx_*_domain_kind`)
- [x] Add `primary_concept_ids` and `supporting_concept_ids` columns to exercise templates
- [x] Add `problem_statement`, `source`, `author_notes` columns to exercise templates
- [x] Create indexes for hierarchical domain_id prefix queries

### Phase 4: UI Layer (`@deeprecall/dojo-ui`) — Future

- [x] Update BrickNode to show concept kind icons (`ConceptKindIcon`)
- [x] Add domain path display component (`DomainPathBadge`, `DomainBreadcrumb`, `DisciplineIcon`)
- [x] Create concept kind badge (`ConceptKindBadge`)
- [x] Create exercise kind badge (`ExerciseKindBadge`)
- [x] Update exercise cards to show exercise kind
- [x] Add exercise kind filter to exercise filters
- [x] Add concept kind filter component (`ConceptKindFilter`)

### Phase 5: Content Migration — Future

- [ ] Script to convert existing flat `domain_id` to hierarchical format
- [ ] Default `concept_kind` inference based on existing tags/names
- [ ] Default `exercise_kind` inference based on existing exercise tags
