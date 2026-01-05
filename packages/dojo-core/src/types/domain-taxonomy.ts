/**
 * Domain Taxonomy Types
 *
 * Hierarchical classification system for concepts and exercises:
 * - Discipline: math, physics, cs, engineering, other
 * - Area: major branch within discipline (e.g., algebra, analysis, classical-mechanics)
 * - Subarea: specific topic within area (e.g., linear-algebra, real-analysis, lagrangian)
 *
 * Domain IDs use dot notation: "<discipline>.<area>[.<subarea>]"
 * Examples:
 *   - "math.algebra.linear-algebra"
 *   - "physics.classical-mechanics.lagrangian"
 *   - "cs.algorithms.graph-algorithms"
 */

// =============================================================================
// Discipline (Top-Level)
// =============================================================================

/**
 * Top-level discipline categories
 */
export type DisciplineId = "math" | "physics" | "cs" | "engineering" | "other";

export const DISCIPLINE_IDS: DisciplineId[] = [
  "math",
  "physics",
  "cs",
  "engineering",
  "other",
];

export const DISCIPLINE_LABELS: Record<DisciplineId, string> = {
  math: "Mathematics",
  physics: "Physics",
  cs: "Computer Science",
  engineering: "Engineering",
  other: "Other",
};

// =============================================================================
// Known Areas per Discipline
// =============================================================================

// -----------------------------------------------------------------------------
// Mathematics Areas (11 Level-1 Domains)
// Based on "Areas of mathematics" classification
// -----------------------------------------------------------------------------

/**
 * Known areas within Mathematics
 * Based on MATH_PHYSICS_LIST.md comprehensive taxonomy
 *
 * Domain IDs use format: math.<area>
 * Example: math.foundations, math.algebra, math.analysis
 */
export const MATH_AREAS = [
  "foundations", // Foundations & Logic
  "algebra", // Algebra
  "analysis", // Analysis
  "discrete", // Discrete Mathematics
  "geometry", // Geometry
  "topology", // Topology
  "number-theory", // Number Theory
  "probability-statistics", // Probability & Statistics
  "applied", // Applied Mathematics & Modelling
  "computational", // Computational Mathematics & Numerical Analysis
  "math-physics", // Mathematical Physics & Systems Science
] as const;

export type MathArea = (typeof MATH_AREAS)[number];

export const MATH_AREA_LABELS: Record<MathArea, string> = {
  foundations: "Foundations & Logic",
  algebra: "Algebra",
  analysis: "Analysis",
  discrete: "Discrete Mathematics",
  geometry: "Geometry",
  topology: "Topology",
  "number-theory": "Number Theory",
  "probability-statistics": "Probability & Statistics",
  applied: "Applied Mathematics & Modelling",
  computational: "Computational Mathematics & Numerical Analysis",
  "math-physics": "Mathematical Physics & Systems",
};

// -----------------------------------------------------------------------------
// Mathematics Subareas (Level-2)
// -----------------------------------------------------------------------------

/**
 * Subareas within Math > Foundations & Logic
 */
export const FOUNDATIONS_SUBAREAS = [
  "mathematical-logic",
  "proof-theory",
  "model-theory",
  "computability-theory",
  "non-classical-logics",
  "set-theory",
  "axiomatic-set-theory",
  "descriptive-set-theory",
  "forcing",
  "category-theory",
  "higher-category-theory",
  "topos-theory",
  "type-theory",
  "dependent-type-theory",
  "hott",
  "philosophy-of-math",
  "information-theory",
] as const;

export type FoundationsSubarea = (typeof FOUNDATIONS_SUBAREAS)[number];

export const FOUNDATIONS_SUBAREA_LABELS: Record<FoundationsSubarea, string> = {
  "mathematical-logic": "Mathematical Logic",
  "proof-theory": "Proof Theory",
  "model-theory": "Model Theory",
  "computability-theory": "Computability Theory",
  "non-classical-logics": "Non-classical Logics",
  "set-theory": "Set Theory",
  "axiomatic-set-theory": "Axiomatic Set Theory",
  "descriptive-set-theory": "Descriptive Set Theory",
  forcing: "Forcing & Independence",
  "category-theory": "Category Theory",
  "higher-category-theory": "Higher Category Theory",
  "topos-theory": "Topos Theory",
  "type-theory": "Type Theory",
  "dependent-type-theory": "Dependent Type Theory",
  hott: "Homotopy Type Theory",
  "philosophy-of-math": "Philosophy of Mathematics",
  "information-theory": "Information Theory",
};

/**
 * Subareas within Math > Algebra
 */
export const ALGEBRA_SUBAREAS = [
  "elementary-algebra",
  "linear-algebra",
  "vector-spaces",
  "matrices",
  "inner-product-spaces",
  "abstract-algebra",
  "group-theory",
  "ring-theory",
  "field-theory",
  "module-theory",
  "representation-theory",
  "commutative-algebra",
  "noncommutative-algebra",
  "homological-algebra",
  "algebraic-structures",
  "lattices",
  "boolean-algebras",
  "universal-algebra",
  "lie-theory",
  "lie-algebras",
  "lie-groups",
  "algebraic-coding",
  "cryptography",
] as const;

export type AlgebraSubarea = (typeof ALGEBRA_SUBAREAS)[number];

export const ALGEBRA_SUBAREA_LABELS: Record<AlgebraSubarea, string> = {
  "elementary-algebra": "Elementary Algebra",
  "linear-algebra": "Linear Algebra",
  "vector-spaces": "Vector Spaces",
  matrices: "Matrices",
  "inner-product-spaces": "Inner Product Spaces",
  "abstract-algebra": "Abstract Algebra",
  "group-theory": "Group Theory",
  "ring-theory": "Ring Theory",
  "field-theory": "Field Theory",
  "module-theory": "Module Theory",
  "representation-theory": "Representation Theory",
  "commutative-algebra": "Commutative Algebra",
  "noncommutative-algebra": "Noncommutative Algebra",
  "homological-algebra": "Homological Algebra",
  "algebraic-structures": "Algebraic Structures",
  lattices: "Lattices",
  "boolean-algebras": "Boolean Algebras",
  "universal-algebra": "Universal Algebra",
  "lie-theory": "Lie Theory",
  "lie-algebras": "Lie Algebras",
  "lie-groups": "Lie Groups",
  "algebraic-coding": "Algebraic Coding",
  cryptography: "Cryptography",
};

/**
 * Subareas within Math > Analysis
 */
export const ANALYSIS_SUBAREAS = [
  "real-analysis",
  "sequences-and-series",
  "continuity-differentiability",
  "measure-theory",
  "integration",
  "complex-analysis",
  "holomorphic-functions",
  "riemann-surfaces",
  "analytic-continuation",
  "residues",
  "functional-analysis",
  "banach-spaces",
  "hilbert-spaces",
  "operator-theory",
  "spectral-theory",
  "harmonic-analysis",
  "fourier-series",
  "fourier-transforms",
  "wavelets",
  "differential-equations",
  "ode",
  "pde",
  "dynamical-systems",
  "stability",
  "chaos",
  "geometric-measure-theory",
  "potential-theory",
  "vector-calculus",
] as const;

export type AnalysisSubarea = (typeof ANALYSIS_SUBAREAS)[number];

export const ANALYSIS_SUBAREA_LABELS: Record<AnalysisSubarea, string> = {
  "real-analysis": "Real Analysis",
  "sequences-and-series": "Sequences & Series",
  "continuity-differentiability": "Continuity & Differentiability",
  "measure-theory": "Measure Theory",
  integration: "Integration",
  "complex-analysis": "Complex Analysis",
  "holomorphic-functions": "Holomorphic Functions",
  "riemann-surfaces": "Riemann Surfaces",
  "analytic-continuation": "Analytic Continuation",
  residues: "Residues",
  "functional-analysis": "Functional Analysis",
  "banach-spaces": "Banach Spaces",
  "hilbert-spaces": "Hilbert Spaces",
  "operator-theory": "Operator Theory",
  "spectral-theory": "Spectral Theory",
  "harmonic-analysis": "Harmonic Analysis",
  "fourier-series": "Fourier Series",
  "fourier-transforms": "Fourier Transforms",
  wavelets: "Wavelets",
  "differential-equations": "Differential Equations",
  ode: "Ordinary Differential Equations",
  pde: "Partial Differential Equations",
  "dynamical-systems": "Dynamical Systems",
  stability: "Stability Theory",
  chaos: "Chaos Theory",
  "geometric-measure-theory": "Geometric Measure Theory",
  "potential-theory": "Potential Theory",
  "vector-calculus": "Vector Calculus",
};

/**
 * Subareas within Math > Discrete Mathematics
 */
export const DISCRETE_SUBAREAS = [
  "combinatorics",
  "enumerative-combinatorics",
  "algebraic-combinatorics",
  "probabilistic-combinatorics",
  "graph-theory",
  "structural-graph-theory",
  "random-graphs",
  "order-theory",
  "lattice-theory",
  "discrete-optimization",
  "integer-programming",
  "boolean-functions",
  "circuits",
] as const;

export type DiscreteSubarea = (typeof DISCRETE_SUBAREAS)[number];

export const DISCRETE_SUBAREA_LABELS: Record<DiscreteSubarea, string> = {
  combinatorics: "Combinatorics",
  "enumerative-combinatorics": "Enumerative Combinatorics",
  "algebraic-combinatorics": "Algebraic Combinatorics",
  "probabilistic-combinatorics": "Probabilistic Combinatorics",
  "graph-theory": "Graph Theory",
  "structural-graph-theory": "Structural Graph Theory",
  "random-graphs": "Random Graphs",
  "order-theory": "Order Theory",
  "lattice-theory": "Lattice Theory",
  "discrete-optimization": "Discrete Optimization",
  "integer-programming": "Integer Programming",
  "boolean-functions": "Boolean Functions",
  circuits: "Circuits",
};

/**
 * Subareas within Math > Geometry
 */
export const GEOMETRY_SUBAREAS = [
  "euclidean-geometry",
  "plane-geometry",
  "solid-geometry",
  "transformational-geometry",
  "non-euclidean-geometry",
  "hyperbolic-geometry",
  "elliptic-geometry",
  "differential-geometry",
  "riemannian-geometry",
  "pseudo-riemannian-geometry",
  "curvature",
  "geodesics",
  "algebraic-geometry",
  "affine-varieties",
  "projective-varieties",
  "schemes",
  "symplectic-geometry",
  "complex-geometry",
  "discrete-geometry",
  "computational-geometry",
  "convex-geometry",
] as const;

export type GeometrySubarea = (typeof GEOMETRY_SUBAREAS)[number];

export const GEOMETRY_SUBAREA_LABELS: Record<GeometrySubarea, string> = {
  "euclidean-geometry": "Euclidean Geometry",
  "plane-geometry": "Plane Geometry",
  "solid-geometry": "Solid Geometry",
  "transformational-geometry": "Transformational Geometry",
  "non-euclidean-geometry": "Non-Euclidean Geometry",
  "hyperbolic-geometry": "Hyperbolic Geometry",
  "elliptic-geometry": "Elliptic Geometry",
  "differential-geometry": "Differential Geometry",
  "riemannian-geometry": "Riemannian Geometry",
  "pseudo-riemannian-geometry": "Pseudo-Riemannian Geometry",
  curvature: "Curvature",
  geodesics: "Geodesics",
  "algebraic-geometry": "Algebraic Geometry",
  "affine-varieties": "Affine Varieties",
  "projective-varieties": "Projective Varieties",
  schemes: "Schemes",
  "symplectic-geometry": "Symplectic Geometry",
  "complex-geometry": "Complex Geometry",
  "discrete-geometry": "Discrete Geometry",
  "computational-geometry": "Computational Geometry",
  "convex-geometry": "Convex Geometry",
};

/**
 * Subareas within Math > Topology
 */
export const TOPOLOGY_SUBAREAS = [
  "general-topology",
  "point-set-topology",
  "algebraic-topology",
  "homology",
  "cohomology",
  "homotopy",
  "differential-topology",
  "geometric-topology",
  "knot-theory",
] as const;

export type TopologySubarea = (typeof TOPOLOGY_SUBAREAS)[number];

export const TOPOLOGY_SUBAREA_LABELS: Record<TopologySubarea, string> = {
  "general-topology": "General Topology",
  "point-set-topology": "Point-Set Topology",
  "algebraic-topology": "Algebraic Topology",
  homology: "Homology",
  cohomology: "Cohomology",
  homotopy: "Homotopy",
  "differential-topology": "Differential Topology",
  "geometric-topology": "Geometric Topology",
  "knot-theory": "Knot Theory",
};

/**
 * Subareas within Math > Number Theory
 */
export const NUMBER_THEORY_SUBAREAS = [
  "elementary-number-theory",
  "divisibility",
  "modular-arithmetic",
  "diophantine-equations",
  "analytic-number-theory",
  "zeta-functions",
  "prime-distribution",
  "algebraic-number-theory",
  "number-fields",
  "rings-of-integers",
  "class-groups",
  "arithmetic-geometry",
  "diophantine-geometry",
  "transcendence-theory",
  "diophantine-approximation",
] as const;

export type NumberTheorySubarea = (typeof NUMBER_THEORY_SUBAREAS)[number];

export const NUMBER_THEORY_SUBAREA_LABELS: Record<NumberTheorySubarea, string> =
  {
    "elementary-number-theory": "Elementary Number Theory",
    divisibility: "Divisibility",
    "modular-arithmetic": "Modular Arithmetic",
    "diophantine-equations": "Diophantine Equations",
    "analytic-number-theory": "Analytic Number Theory",
    "zeta-functions": "Zeta Functions",
    "prime-distribution": "Prime Distribution",
    "algebraic-number-theory": "Algebraic Number Theory",
    "number-fields": "Number Fields",
    "rings-of-integers": "Rings of Integers",
    "class-groups": "Class Groups",
    "arithmetic-geometry": "Arithmetic Geometry",
    "diophantine-geometry": "Diophantine Geometry",
    "transcendence-theory": "Transcendence Theory",
    "diophantine-approximation": "Diophantine Approximation",
  };

/**
 * Subareas within Math > Probability & Statistics
 */
export const PROBABILITY_STATISTICS_SUBAREAS = [
  "probability-theory",
  "measure-theoretic-probability",
  "random-variables",
  "limit-theorems",
  "stochastic-processes",
  "mathematical-statistics",
  "estimation",
  "hypothesis-testing",
  "bayesian-statistics",
  "stochastic-analysis",
  "random-fields",
  "statistical-learning-theory",
] as const;

export type ProbabilityStatisticsSubarea =
  (typeof PROBABILITY_STATISTICS_SUBAREAS)[number];

export const PROBABILITY_STATISTICS_SUBAREA_LABELS: Record<
  ProbabilityStatisticsSubarea,
  string
> = {
  "probability-theory": "Probability Theory",
  "measure-theoretic-probability": "Measure-Theoretic Probability",
  "random-variables": "Random Variables",
  "limit-theorems": "Limit Theorems",
  "stochastic-processes": "Stochastic Processes",
  "mathematical-statistics": "Mathematical Statistics",
  estimation: "Estimation",
  "hypothesis-testing": "Hypothesis Testing",
  "bayesian-statistics": "Bayesian Statistics",
  "stochastic-analysis": "Stochastic Analysis",
  "random-fields": "Random Fields",
  "statistical-learning-theory": "Statistical Learning Theory",
};

/**
 * Subareas within Math > Applied Mathematics & Modelling
 */
export const APPLIED_SUBAREAS = [
  "mathematical-physics-applied",
  "mathematical-biology",
  "mathematical-finance",
  "mathematical-economics",
  "mathematical-chemistry",
  "mathematical-psychology",
  "game-theory",
  "control-theory",
  "operations-research",
  "queuing-theory",
  "decision-processes",
  "systems-science",
  "dynamical-systems-applied",
] as const;

export type AppliedSubarea = (typeof APPLIED_SUBAREAS)[number];

export const APPLIED_SUBAREA_LABELS: Record<AppliedSubarea, string> = {
  "mathematical-physics-applied": "Mathematical Physics (Applied)",
  "mathematical-biology": "Mathematical Biology",
  "mathematical-finance": "Mathematical Finance",
  "mathematical-economics": "Mathematical Economics",
  "mathematical-chemistry": "Mathematical Chemistry",
  "mathematical-psychology": "Mathematical Psychology",
  "game-theory": "Game Theory",
  "control-theory": "Control Theory",
  "operations-research": "Operations Research",
  "queuing-theory": "Queuing Theory",
  "decision-processes": "Decision Processes",
  "systems-science": "Systems Science",
  "dynamical-systems-applied": "Dynamical Systems (Applied)",
};

/**
 * Subareas within Math > Computational Mathematics & Numerical Analysis
 */
export const COMPUTATIONAL_SUBAREAS = [
  "numerical-analysis",
  "numerical-linear-algebra",
  "numerical-integration",
  "approximation-theory",
  "optimization",
  "continuous-optimization",
  "convex-optimization",
  "nonlinear-programming",
  "computer-algebra",
  "theory-of-computation",
  "algorithms",
  "complexity-theory",
  "automata",
  "formal-languages",
  "scientific-computing",
  "hpc",
  "finite-element",
  "finite-volume",
] as const;

export type ComputationalSubarea = (typeof COMPUTATIONAL_SUBAREAS)[number];

export const COMPUTATIONAL_SUBAREA_LABELS: Record<
  ComputationalSubarea,
  string
> = {
  "numerical-analysis": "Numerical Analysis",
  "numerical-linear-algebra": "Numerical Linear Algebra",
  "numerical-integration": "Numerical Integration",
  "approximation-theory": "Approximation Theory",
  optimization: "Optimization",
  "continuous-optimization": "Continuous Optimization",
  "convex-optimization": "Convex Optimization",
  "nonlinear-programming": "Nonlinear Programming",
  "computer-algebra": "Computer Algebra",
  "theory-of-computation": "Theory of Computation",
  algorithms: "Algorithms",
  "complexity-theory": "Complexity Theory",
  automata: "Automata",
  "formal-languages": "Formal Languages",
  "scientific-computing": "Scientific Computing",
  hpc: "High-Performance Computing",
  "finite-element": "Finite Element Methods",
  "finite-volume": "Finite Volume Methods",
};

/**
 * Subareas within Math > Mathematical Physics & Systems
 */
export const MATH_PHYSICS_SUBAREAS = [
  "classical-mathematical-physics",
  "wave-equation",
  "heat-equation",
  "poisson-equation",
  "maxwell-equations-math",
  "navier-stokes",
  "quantum-mathematical-physics",
  "scattering-theory",
  "qft-mathematical",
  "integrable-systems",
  "spectral-theory-physics",
  "operator-algebras",
  "statistical-mechanics-math",
  "geometric-methods-physics",
  "geometric-quantization",
] as const;

export type MathPhysicsSubarea = (typeof MATH_PHYSICS_SUBAREAS)[number];

export const MATH_PHYSICS_SUBAREA_LABELS: Record<MathPhysicsSubarea, string> = {
  "classical-mathematical-physics": "Classical Mathematical Physics",
  "wave-equation": "Wave Equation",
  "heat-equation": "Heat Equation",
  "poisson-equation": "Poisson Equation",
  "maxwell-equations-math": "Maxwell's Equations (Mathematical)",
  "navier-stokes": "Navier-Stokes Equations",
  "quantum-mathematical-physics": "Quantum Mathematical Physics",
  "scattering-theory": "Scattering Theory",
  "qft-mathematical": "Quantum Field Theory (Mathematical)",
  "integrable-systems": "Integrable Systems",
  "spectral-theory-physics": "Spectral Theory",
  "operator-algebras": "Operator Algebras",
  "statistical-mechanics-math": "Statistical Mechanics (Mathematical)",
  "geometric-methods-physics": "Geometric Methods in Physics",
  "geometric-quantization": "Geometric Quantization",
};

// -----------------------------------------------------------------------------
// Physics Areas (13 Level-1 Domains)
// Based on "Branches of Physics" classification
// -----------------------------------------------------------------------------

/**
 * Known areas within Physics
 * Based on MATH_PHYSICS_LIST.md comprehensive taxonomy
 *
 * Domain IDs use format: physics.<area>
 * Example: physics.mechanics, physics.quantum, physics.condensed
 */
export const PHYSICS_AREAS = [
  "mechanics", // Classical & Continuum Mechanics
  "thermo-stat", // Thermodynamics & Statistical Physics
  "em-optics", // Electromagnetism, Optics & Photonics
  "relativity", // Relativity & Gravitation
  "quantum", // Quantum Physics (Core Theory)
  "amo", // Atomic, Molecular & Optical Physics
  "condensed", // Condensed Matter & Materials Physics
  "nuclear-particle", // Nuclear & Particle Physics
  "plasma", // Plasma & High-Energy Density Physics
  "astro-cosmo", // Astrophysics & Cosmology
  "earth-env", // Earth & Environmental Physics
  "bio-med", // Biophysics & Medical Physics
  "methods", // Computational & Experimental Methods
] as const;

export type PhysicsArea = (typeof PHYSICS_AREAS)[number];

export const PHYSICS_AREA_LABELS: Record<PhysicsArea, string> = {
  mechanics: "Classical & Continuum Mechanics",
  "thermo-stat": "Thermodynamics & Statistical Physics",
  "em-optics": "Electromagnetism, Optics & Photonics",
  relativity: "Relativity & Gravitation",
  quantum: "Quantum Physics",
  amo: "Atomic, Molecular & Optical Physics",
  condensed: "Condensed Matter & Materials Physics",
  "nuclear-particle": "Nuclear & Particle Physics",
  plasma: "Plasma & High-Energy Density Physics",
  "astro-cosmo": "Astrophysics & Cosmology",
  "earth-env": "Earth & Environmental Physics",
  "bio-med": "Biophysics & Medical Physics",
  methods: "Computational & Experimental Methods",
};

// -----------------------------------------------------------------------------
// Physics Subareas (Level-2)
// -----------------------------------------------------------------------------

/**
 * Subareas within Physics > Classical & Continuum Mechanics
 */
export const MECHANICS_SUBAREAS = [
  "newtonian-mechanics",
  "kinematics",
  "dynamics",
  "statics",
  "lagrangian-mechanics",
  "hamiltonian-mechanics",
  "rigid-body-mechanics",
  "continuum-mechanics",
  "elasticity",
  "solid-mechanics",
  "fluid-mechanics",
  "nonlinear-dynamics",
  "chaos-physics",
  "vibrations",
  "acoustics",
  "classical-waves",
] as const;

export type MechanicsSubarea = (typeof MECHANICS_SUBAREAS)[number];

export const MECHANICS_SUBAREA_LABELS: Record<MechanicsSubarea, string> = {
  "newtonian-mechanics": "Newtonian Mechanics",
  kinematics: "Kinematics",
  dynamics: "Dynamics",
  statics: "Statics",
  "lagrangian-mechanics": "Lagrangian Mechanics",
  "hamiltonian-mechanics": "Hamiltonian Mechanics",
  "rigid-body-mechanics": "Rigid Body Mechanics",
  "continuum-mechanics": "Continuum Mechanics",
  elasticity: "Elasticity",
  "solid-mechanics": "Solid Mechanics",
  "fluid-mechanics": "Fluid Mechanics",
  "nonlinear-dynamics": "Nonlinear Dynamics",
  "chaos-physics": "Chaos",
  vibrations: "Vibrations",
  acoustics: "Acoustics",
  "classical-waves": "Classical Waves",
};

/**
 * Subareas within Physics > Thermodynamics & Statistical Physics
 */
export const THERMO_STAT_SUBAREAS = [
  "classical-thermodynamics",
  "laws-of-thermodynamics",
  "equations-of-state",
  "thermodynamic-potentials",
  "statistical-mechanics",
  "ensembles",
  "partition-functions",
  "ising-models",
  "non-equilibrium-thermodynamics",
  "kinetic-theory",
  "boltzmann-equation",
  "transport-phenomena",
  "soft-matter",
  "granular-media",
] as const;

export type ThermoStatSubarea = (typeof THERMO_STAT_SUBAREAS)[number];

export const THERMO_STAT_SUBAREA_LABELS: Record<ThermoStatSubarea, string> = {
  "classical-thermodynamics": "Classical Thermodynamics",
  "laws-of-thermodynamics": "Laws of Thermodynamics",
  "equations-of-state": "Equations of State",
  "thermodynamic-potentials": "Thermodynamic Potentials",
  "statistical-mechanics": "Statistical Mechanics",
  ensembles: "Ensembles",
  "partition-functions": "Partition Functions",
  "ising-models": "Ising-like Models",
  "non-equilibrium-thermodynamics": "Non-equilibrium Thermodynamics",
  "kinetic-theory": "Kinetic Theory",
  "boltzmann-equation": "Boltzmann Equation",
  "transport-phenomena": "Transport Phenomena",
  "soft-matter": "Soft Matter",
  "granular-media": "Granular Media",
};

/**
 * Subareas within Physics > Electromagnetism, Optics & Photonics
 */
export const EM_OPTICS_SUBAREAS = [
  "classical-electromagnetism",
  "maxwell-equations",
  "waves-in-media",
  "electrostatics",
  "magnetostatics",
  "electrodynamics",
  "radiation",
  "optics",
  "geometrical-optics",
  "physical-optics",
  "interference",
  "diffraction",
  "polarization",
  "photonics",
  "waveguides",
  "photonic-crystals",
  "lasers",
  "nonlinear-optics",
  "metamaterials",
  "plasmonics",
] as const;

export type EmOpticsSubarea = (typeof EM_OPTICS_SUBAREAS)[number];

export const EM_OPTICS_SUBAREA_LABELS: Record<EmOpticsSubarea, string> = {
  "classical-electromagnetism": "Classical Electromagnetism",
  "maxwell-equations": "Maxwell's Equations",
  "waves-in-media": "Waves in Media",
  electrostatics: "Electrostatics",
  magnetostatics: "Magnetostatics",
  electrodynamics: "Electrodynamics",
  radiation: "Radiation",
  optics: "Optics",
  "geometrical-optics": "Geometrical Optics",
  "physical-optics": "Physical Optics",
  interference: "Interference",
  diffraction: "Diffraction",
  polarization: "Polarization",
  photonics: "Photonics",
  waveguides: "Waveguides",
  "photonic-crystals": "Photonic Crystals",
  lasers: "Lasers",
  "nonlinear-optics": "Nonlinear Optics",
  metamaterials: "Metamaterials",
  plasmonics: "Plasmonics",
};

/**
 * Subareas within Physics > Relativity & Gravitation
 */
export const RELATIVITY_SUBAREAS = [
  "special-relativity",
  "lorentz-transformations",
  "minkowski-spacetime",
  "general-relativity",
  "einstein-equations",
  "curvature-gr",
  "black-holes",
  "gravitational-waves",
  "experimental-gravity",
  "relativistic-astrophysics",
  "relativistic-cosmology",
  "alternative-gravity",
  "loop-quantum-gravity",
  "string-gravity",
] as const;

export type RelativitySubarea = (typeof RELATIVITY_SUBAREAS)[number];

export const RELATIVITY_SUBAREA_LABELS: Record<RelativitySubarea, string> = {
  "special-relativity": "Special Relativity",
  "lorentz-transformations": "Lorentz Transformations",
  "minkowski-spacetime": "Minkowski Spacetime",
  "general-relativity": "General Relativity",
  "einstein-equations": "Einstein Equations",
  "curvature-gr": "Curvature",
  "black-holes": "Black Holes",
  "gravitational-waves": "Gravitational Waves",
  "experimental-gravity": "Experimental Gravity",
  "relativistic-astrophysics": "Relativistic Astrophysics",
  "relativistic-cosmology": "Relativistic Cosmology",
  "alternative-gravity": "Alternative Gravity Theories",
  "loop-quantum-gravity": "Loop Quantum Gravity",
  "string-gravity": "String-inspired Gravity",
};

/**
 * Subareas within Physics > Quantum Physics
 */
export const QUANTUM_SUBAREAS = [
  "nonrelativistic-qm",
  "schrodinger-equation",
  "postulates",
  "spin-angular-momentum",
  "scattering",
  "many-body-qm",
  "quantum-field-theory",
  "qed",
  "qcd",
  "quantum-foundations",
  "interpretations",
  "bells-theorem",
  "quantum-information",
  "quantum-computing",
  "qubits",
  "quantum-channels",
  "error-correction",
] as const;

export type QuantumSubarea = (typeof QUANTUM_SUBAREAS)[number];

export const QUANTUM_SUBAREA_LABELS: Record<QuantumSubarea, string> = {
  "nonrelativistic-qm": "Non-relativistic Quantum Mechanics",
  "schrodinger-equation": "Schrödinger Equation",
  postulates: "Quantum Postulates",
  "spin-angular-momentum": "Spin & Angular Momentum",
  scattering: "Scattering Theory",
  "many-body-qm": "Many-Body Quantum Mechanics",
  "quantum-field-theory": "Quantum Field Theory",
  qed: "Quantum Electrodynamics",
  qcd: "Quantum Chromodynamics",
  "quantum-foundations": "Quantum Foundations",
  interpretations: "Interpretations of QM",
  "bells-theorem": "Bell's Theorem",
  "quantum-information": "Quantum Information",
  "quantum-computing": "Quantum Computing",
  qubits: "Qubits",
  "quantum-channels": "Quantum Channels",
  "error-correction": "Error Correction",
};

/**
 * Subareas within Physics > Atomic, Molecular & Optical Physics
 */
export const AMO_SUBAREAS = [
  "atomic-physics",
  "atomic-structure",
  "atomic-spectra",
  "molecular-physics",
  "molecular-structure",
  "molecular-spectroscopy",
  "optical-physics",
  "laser-physics",
  "laser-matter-interaction",
  "cold-atoms",
  "bec",
  "optical-lattices",
  "precision-measurement",
  "metrology",
] as const;

export type AmoSubarea = (typeof AMO_SUBAREAS)[number];

export const AMO_SUBAREA_LABELS: Record<AmoSubarea, string> = {
  "atomic-physics": "Atomic Physics",
  "atomic-structure": "Atomic Structure",
  "atomic-spectra": "Atomic Spectra",
  "molecular-physics": "Molecular Physics",
  "molecular-structure": "Molecular Structure",
  "molecular-spectroscopy": "Molecular Spectroscopy",
  "optical-physics": "Optical Physics",
  "laser-physics": "Laser Physics",
  "laser-matter-interaction": "Laser-Matter Interaction",
  "cold-atoms": "Cold Atoms",
  bec: "Bose-Einstein Condensates",
  "optical-lattices": "Optical Lattices",
  "precision-measurement": "Precision Measurement",
  metrology: "Metrology",
};

/**
 * Subareas within Physics > Condensed Matter & Materials Physics
 */
export const CONDENSED_SUBAREAS = [
  "solid-state-physics",
  "crystal-structure",
  "band-theory",
  "electronic-properties",
  "transport-properties",
  "magnetism",
  "spin-systems",
  "superconductivity",
  "superfluidity",
  "soft-condensed-matter",
  "polymers",
  "liquid-crystals",
  "colloids",
  "low-temperature-physics",
  "nanoscale-physics",
  "mesoscopic-physics",
  "materials-physics",
  "structure-property",
  "defects",
  "phase-diagrams",
] as const;

export type CondensedSubarea = (typeof CONDENSED_SUBAREAS)[number];

export const CONDENSED_SUBAREA_LABELS: Record<CondensedSubarea, string> = {
  "solid-state-physics": "Solid-State Physics",
  "crystal-structure": "Crystal Structure",
  "band-theory": "Band Theory",
  "electronic-properties": "Electronic Properties",
  "transport-properties": "Transport Properties",
  magnetism: "Magnetism",
  "spin-systems": "Spin Systems",
  superconductivity: "Superconductivity",
  superfluidity: "Superfluidity",
  "soft-condensed-matter": "Soft Condensed Matter",
  polymers: "Polymers",
  "liquid-crystals": "Liquid Crystals",
  colloids: "Colloids",
  "low-temperature-physics": "Low-Temperature Physics",
  "nanoscale-physics": "Nanoscale Physics",
  "mesoscopic-physics": "Mesoscopic Physics",
  "materials-physics": "Materials Physics",
  "structure-property": "Structure-Property Relations",
  defects: "Defects",
  "phase-diagrams": "Phase Diagrams",
};

/**
 * Subareas within Physics > Nuclear & Particle Physics
 */
export const NUCLEAR_PARTICLE_SUBAREAS = [
  "nuclear-structure",
  "nuclear-reactions",
  "nuclear-models",
  "fission",
  "fusion",
  "particle-physics",
  "standard-model",
  "gauge-theories",
  "experimental-hep",
  "colliders",
  "detectors",
  "astroparticle-physics",
  "cosmic-rays",
  "neutrino-astronomy",
] as const;

export type NuclearParticleSubarea = (typeof NUCLEAR_PARTICLE_SUBAREAS)[number];

export const NUCLEAR_PARTICLE_SUBAREA_LABELS: Record<
  NuclearParticleSubarea,
  string
> = {
  "nuclear-structure": "Nuclear Structure",
  "nuclear-reactions": "Nuclear Reactions",
  "nuclear-models": "Nuclear Models",
  fission: "Fission",
  fusion: "Fusion",
  "particle-physics": "Particle Physics",
  "standard-model": "Standard Model",
  "gauge-theories": "Gauge Theories",
  "experimental-hep": "Experimental High-Energy Physics",
  colliders: "Colliders",
  detectors: "Detectors",
  "astroparticle-physics": "Astroparticle Physics",
  "cosmic-rays": "Cosmic Rays",
  "neutrino-astronomy": "Neutrino Astronomy",
};

/**
 * Subareas within Physics > Plasma & High-Energy Density Physics
 */
export const PLASMA_SUBAREAS = [
  "basic-plasma-physics",
  "debye-shielding",
  "collective-modes",
  "magnetized-plasmas",
  "mhd",
  "space-plasmas",
  "astrophysical-plasmas",
  "fusion-plasmas",
  "magnetic-confinement",
  "inertial-confinement",
  "high-energy-density-physics",
  "laser-plasma-interaction",
  "warm-dense-matter",
] as const;

export type PlasmaSubarea = (typeof PLASMA_SUBAREAS)[number];

export const PLASMA_SUBAREA_LABELS: Record<PlasmaSubarea, string> = {
  "basic-plasma-physics": "Basic Plasma Physics",
  "debye-shielding": "Debye Shielding",
  "collective-modes": "Collective Modes",
  "magnetized-plasmas": "Magnetized Plasmas",
  mhd: "Magnetohydrodynamics",
  "space-plasmas": "Space Plasmas",
  "astrophysical-plasmas": "Astrophysical Plasmas",
  "fusion-plasmas": "Fusion Plasmas",
  "magnetic-confinement": "Magnetic Confinement",
  "inertial-confinement": "Inertial Confinement",
  "high-energy-density-physics": "High-Energy Density Physics",
  "laser-plasma-interaction": "Laser-Plasma Interaction",
  "warm-dense-matter": "Warm Dense Matter",
};

/**
 * Subareas within Physics > Astrophysics & Cosmology
 */
export const ASTRO_COSMO_SUBAREAS = [
  "stellar-physics",
  "stellar-structure",
  "stellar-evolution",
  "galactic-astrophysics",
  "extragalactic-astrophysics",
  "compact-objects",
  "neutron-stars",
  "black-holes-astro",
  "cosmology",
  "big-bang",
  "inflation",
  "dark-matter",
  "dark-energy",
  "high-energy-astrophysics",
  "grbs",
  "agn",
  "cosmic-rays-astro",
  "planetary-science",
  "planet-formation",
  "exoplanets",
] as const;

export type AstroCosmoSubarea = (typeof ASTRO_COSMO_SUBAREAS)[number];

export const ASTRO_COSMO_SUBAREA_LABELS: Record<AstroCosmoSubarea, string> = {
  "stellar-physics": "Stellar Physics",
  "stellar-structure": "Stellar Structure",
  "stellar-evolution": "Stellar Evolution",
  "galactic-astrophysics": "Galactic Astrophysics",
  "extragalactic-astrophysics": "Extragalactic Astrophysics",
  "compact-objects": "Compact Objects",
  "neutron-stars": "Neutron Stars",
  "black-holes-astro": "Black Holes (Astrophysical)",
  cosmology: "Cosmology",
  "big-bang": "Big Bang",
  inflation: "Inflation",
  "dark-matter": "Dark Matter",
  "dark-energy": "Dark Energy",
  "high-energy-astrophysics": "High-Energy Astrophysics",
  grbs: "Gamma-Ray Bursts",
  agn: "Active Galactic Nuclei",
  "cosmic-rays-astro": "Cosmic Rays (Astrophysical)",
  "planetary-science": "Planetary Science",
  "planet-formation": "Planet Formation",
  exoplanets: "Exoplanets",
};

/**
 * Subareas within Physics > Earth & Environmental Physics
 */
export const EARTH_ENV_SUBAREAS = [
  "geophysics",
  "seismology",
  "geomagnetism",
  "geodynamics",
  "atmospheric-physics",
  "radiative-transfer",
  "climate-dynamics",
  "physical-oceanography",
  "cryospheric-physics",
  "environmental-physics",
  "energy-balance",
  "pollution-transport",
] as const;

export type EarthEnvSubarea = (typeof EARTH_ENV_SUBAREAS)[number];

export const EARTH_ENV_SUBAREA_LABELS: Record<EarthEnvSubarea, string> = {
  geophysics: "Geophysics",
  seismology: "Seismology",
  geomagnetism: "Geomagnetism",
  geodynamics: "Geodynamics",
  "atmospheric-physics": "Atmospheric Physics",
  "radiative-transfer": "Radiative Transfer",
  "climate-dynamics": "Climate Dynamics",
  "physical-oceanography": "Physical Oceanography",
  "cryospheric-physics": "Cryospheric Physics",
  "environmental-physics": "Environmental Physics",
  "energy-balance": "Energy Balance",
  "pollution-transport": "Pollution Transport",
};

/**
 * Subareas within Physics > Biophysics & Medical Physics
 */
export const BIO_MED_SUBAREAS = [
  "biophysics",
  "molecular-biophysics",
  "cellular-biophysics",
  "neurobiophysics",
  "biomechanics",
  "medical-physics",
  "imaging-physics",
  "mri",
  "ct",
  "pet",
  "radiation-therapy",
  "radiation-physics-medicine",
] as const;

export type BioMedSubarea = (typeof BIO_MED_SUBAREAS)[number];

export const BIO_MED_SUBAREA_LABELS: Record<BioMedSubarea, string> = {
  biophysics: "Biophysics",
  "molecular-biophysics": "Molecular Biophysics",
  "cellular-biophysics": "Cellular Biophysics",
  neurobiophysics: "Neurobiophysics",
  biomechanics: "Biomechanics",
  "medical-physics": "Medical Physics",
  "imaging-physics": "Imaging Physics",
  mri: "MRI",
  ct: "CT",
  pet: "PET",
  "radiation-therapy": "Radiation Therapy",
  "radiation-physics-medicine": "Radiation Physics in Medicine",
};

/**
 * Subareas within Physics > Computational & Experimental Methods
 */
export const METHODS_SUBAREAS = [
  "computational-physics",
  "numerical-methods-physics",
  "time-integration",
  "spectral-methods-physics",
  "monte-carlo",
  "hpc-physics",
  "gpu-methods",
  "experimental-methods",
  "instrumentation",
  "error-analysis",
  "data-analysis-physics",
  "data-driven-physics",
  "inverse-problems",
  "physics-education-research",
] as const;

export type MethodsSubarea = (typeof METHODS_SUBAREAS)[number];

export const METHODS_SUBAREA_LABELS: Record<MethodsSubarea, string> = {
  "computational-physics": "Computational Physics",
  "numerical-methods-physics": "Numerical Methods in Physics",
  "time-integration": "Time Integration",
  "spectral-methods-physics": "Spectral Methods",
  "monte-carlo": "Monte Carlo Methods",
  "hpc-physics": "High-Performance Computing",
  "gpu-methods": "GPU Methods",
  "experimental-methods": "Experimental Methods",
  instrumentation: "Instrumentation",
  "error-analysis": "Error Analysis",
  "data-analysis-physics": "Data Analysis",
  "data-driven-physics": "Data-Driven Physics",
  "inverse-problems": "Inverse Problems",
  "physics-education-research": "Physics Education Research",
};

// -----------------------------------------------------------------------------
// Computer Science Areas (unchanged)
// -----------------------------------------------------------------------------

/**
 * Known areas within Computer Science
 */
export const CS_AREAS = [
  "algorithms",
  "data-structures",
  "theory",
  "systems",
  "networks",
  "databases",
  "ai-ml",
  "graphics",
  "security",
  "programming-languages",
] as const;

export type CsArea = (typeof CS_AREAS)[number];

export const CS_AREA_LABELS: Record<CsArea, string> = {
  algorithms: "Algorithms",
  "data-structures": "Data Structures",
  theory: "Theory of Computation",
  systems: "Systems",
  networks: "Networks",
  databases: "Databases",
  "ai-ml": "AI & Machine Learning",
  graphics: "Graphics",
  security: "Security",
  "programming-languages": "Programming Languages",
};

// -----------------------------------------------------------------------------
// Aggregate Subarea Lookups
// -----------------------------------------------------------------------------

/**
 * All math subareas by area
 */
export const MATH_SUBAREAS_BY_AREA: Record<MathArea, readonly string[]> = {
  foundations: FOUNDATIONS_SUBAREAS,
  algebra: ALGEBRA_SUBAREAS,
  analysis: ANALYSIS_SUBAREAS,
  discrete: DISCRETE_SUBAREAS,
  geometry: GEOMETRY_SUBAREAS,
  topology: TOPOLOGY_SUBAREAS,
  "number-theory": NUMBER_THEORY_SUBAREAS,
  "probability-statistics": PROBABILITY_STATISTICS_SUBAREAS,
  applied: APPLIED_SUBAREAS,
  computational: COMPUTATIONAL_SUBAREAS,
  "math-physics": MATH_PHYSICS_SUBAREAS,
};

/**
 * All physics subareas by area
 */
export const PHYSICS_SUBAREAS_BY_AREA: Record<PhysicsArea, readonly string[]> =
  {
    mechanics: MECHANICS_SUBAREAS,
    "thermo-stat": THERMO_STAT_SUBAREAS,
    "em-optics": EM_OPTICS_SUBAREAS,
    relativity: RELATIVITY_SUBAREAS,
    quantum: QUANTUM_SUBAREAS,
    amo: AMO_SUBAREAS,
    condensed: CONDENSED_SUBAREAS,
    "nuclear-particle": NUCLEAR_PARTICLE_SUBAREAS,
    plasma: PLASMA_SUBAREAS,
    "astro-cosmo": ASTRO_COSMO_SUBAREAS,
    "earth-env": EARTH_ENV_SUBAREAS,
    "bio-med": BIO_MED_SUBAREAS,
    methods: METHODS_SUBAREAS,
  };

/**
 * All math subarea labels by area
 */
export const MATH_SUBAREA_LABELS_BY_AREA: Record<
  MathArea,
  Record<string, string>
> = {
  foundations: FOUNDATIONS_SUBAREA_LABELS,
  algebra: ALGEBRA_SUBAREA_LABELS,
  analysis: ANALYSIS_SUBAREA_LABELS,
  discrete: DISCRETE_SUBAREA_LABELS,
  geometry: GEOMETRY_SUBAREA_LABELS,
  topology: TOPOLOGY_SUBAREA_LABELS,
  "number-theory": NUMBER_THEORY_SUBAREA_LABELS,
  "probability-statistics": PROBABILITY_STATISTICS_SUBAREA_LABELS,
  applied: APPLIED_SUBAREA_LABELS,
  computational: COMPUTATIONAL_SUBAREA_LABELS,
  "math-physics": MATH_PHYSICS_SUBAREA_LABELS,
};

/**
 * All physics subarea labels by area
 */
export const PHYSICS_SUBAREA_LABELS_BY_AREA: Record<
  PhysicsArea,
  Record<string, string>
> = {
  mechanics: MECHANICS_SUBAREA_LABELS,
  "thermo-stat": THERMO_STAT_SUBAREA_LABELS,
  "em-optics": EM_OPTICS_SUBAREA_LABELS,
  relativity: RELATIVITY_SUBAREA_LABELS,
  quantum: QUANTUM_SUBAREA_LABELS,
  amo: AMO_SUBAREA_LABELS,
  condensed: CONDENSED_SUBAREA_LABELS,
  "nuclear-particle": NUCLEAR_PARTICLE_SUBAREA_LABELS,
  plasma: PLASMA_SUBAREA_LABELS,
  "astro-cosmo": ASTRO_COSMO_SUBAREA_LABELS,
  "earth-env": EARTH_ENV_SUBAREA_LABELS,
  "bio-med": BIO_MED_SUBAREA_LABELS,
  methods: METHODS_SUBAREA_LABELS,
};

// =============================================================================
// Domain Path (Structured Form)
// =============================================================================

/**
 * Structured representation of a domain path
 * Used for parsing and constructing domain IDs
 */
export interface DomainPath {
  /** Top-level discipline */
  discipline: DisciplineId;

  /** Area within discipline */
  area: string;

  /** Optional subarea within area */
  subarea?: string;
}

// =============================================================================
// Concept Kind
// =============================================================================

/**
 * Semantic kind of a concept node
 * Affects UI display and learning recommendations
 */
export type ConceptKind =
  | "object" // A mathematical/physical object (e.g., "symmetric matrix", "Hilbert space")
  | "definition" // A formal definition
  | "property" // A property of objects (e.g., "symmetric matrices are diagonalizable")
  | "theorem" // A major theorem
  | "lemma" // Supporting lemma
  | "corollary" // Consequence of a theorem
  | "axiom" // Foundational axiom
  | "technique" // A method or technique (e.g., "Gaussian elimination")
  | "heuristic" // A rule of thumb or problem-solving strategy
  | "example"; // A canonical example

export const CONCEPT_KINDS: ConceptKind[] = [
  "object",
  "definition",
  "property",
  "theorem",
  "lemma",
  "corollary",
  "axiom",
  "technique",
  "heuristic",
  "example",
];

export const CONCEPT_KIND_LABELS: Record<ConceptKind, string> = {
  object: "Object",
  definition: "Definition",
  property: "Property",
  theorem: "Theorem",
  lemma: "Lemma",
  corollary: "Corollary",
  axiom: "Axiom",
  technique: "Technique",
  heuristic: "Heuristic",
  example: "Example",
};

/**
 * Icons/glyphs for concept kinds (for UI)
 * Using emoji as placeholders; can be replaced with icon library references
 */
export const CONCEPT_KIND_ICONS: Record<ConceptKind, string> = {
  object: "📦",
  definition: "📝",
  property: "✨",
  theorem: "📜",
  lemma: "📎",
  corollary: "➡️",
  axiom: "⚡",
  technique: "🔧",
  heuristic: "💡",
  example: "🎯",
};

// =============================================================================
// Exercise Kind
// =============================================================================

/**
 * Kind of exercise - determines UI behavior and grading approach
 */
export type ExerciseKind =
  | "calculation" // Compute something concrete
  | "concept-check" // Short conceptual questions, definitions
  | "proof-construction" // Write a proof
  | "fill-in-proof" // Complete a guided proof with gaps
  | "multiple-choice" // Select from options
  | "true-false" // True/false with justification
  | "error-analysis" // Find and fix errors in given work
  | "derivation" // Derive a formula or result
  | "application"; // Apply concepts to real-world problem

export const EXERCISE_KINDS: ExerciseKind[] = [
  "calculation",
  "concept-check",
  "proof-construction",
  "fill-in-proof",
  "multiple-choice",
  "true-false",
  "error-analysis",
  "derivation",
  "application",
];

export const EXERCISE_KIND_LABELS: Record<ExerciseKind, string> = {
  calculation: "Calculation",
  "concept-check": "Concept Check",
  "proof-construction": "Proof Construction",
  "fill-in-proof": "Fill-in-Proof",
  "multiple-choice": "Multiple Choice",
  "true-false": "True/False",
  "error-analysis": "Error Analysis",
  derivation: "Derivation",
  application: "Application",
};

/**
 * UI behavior hints for exercise kinds
 */
export interface ExerciseKindBehavior {
  /** Whether to show a prominent timer */
  showTimer: boolean;
  /** Whether to allow/encourage attachments (handwritten work) */
  allowAttachments: boolean;
  /** Whether hints should be progressive */
  progressiveHints: boolean;
  /** Time pressure level */
  timePressure: "none" | "low" | "medium" | "high";
}

export const EXERCISE_KIND_BEHAVIORS: Record<
  ExerciseKind,
  ExerciseKindBehavior
> = {
  calculation: {
    showTimer: true,
    allowAttachments: true,
    progressiveHints: true,
    timePressure: "medium",
  },
  "concept-check": {
    showTimer: false,
    allowAttachments: false,
    progressiveHints: false,
    timePressure: "none",
  },
  "proof-construction": {
    showTimer: false,
    allowAttachments: true,
    progressiveHints: true,
    timePressure: "none",
  },
  "fill-in-proof": {
    showTimer: false,
    allowAttachments: true,
    progressiveHints: true,
    timePressure: "low",
  },
  "multiple-choice": {
    showTimer: true,
    allowAttachments: false,
    progressiveHints: false,
    timePressure: "medium",
  },
  "true-false": {
    showTimer: true,
    allowAttachments: false,
    progressiveHints: false,
    timePressure: "medium",
  },
  "error-analysis": {
    showTimer: false,
    allowAttachments: true,
    progressiveHints: true,
    timePressure: "low",
  },
  derivation: {
    showTimer: false,
    allowAttachments: true,
    progressiveHints: true,
    timePressure: "low",
  },
  application: {
    showTimer: true,
    allowAttachments: true,
    progressiveHints: true,
    timePressure: "medium",
  },
};

// =============================================================================
// Concept Relation Kind (Future)
// =============================================================================

/**
 * Types of relationships between concepts
 * Currently only "prerequisite" is stored; others for future use
 */
export type ConceptRelationKind =
  | "prerequisite" // B must be mastered before A
  | "generalization" // A is a generalization of B
  | "special-case" // A is a special case of B
  | "analogue" // A is an analogue of B in another setting
  | "dual" // e.g., product/sum, contravariant/covariant
  | "equivalent"; // Logically equivalent definitions

export const CONCEPT_RELATION_KINDS: ConceptRelationKind[] = [
  "prerequisite",
  "generalization",
  "special-case",
  "analogue",
  "dual",
  "equivalent",
];

export const CONCEPT_RELATION_KIND_LABELS: Record<ConceptRelationKind, string> =
  {
    prerequisite: "Prerequisite",
    generalization: "Generalization",
    "special-case": "Special Case",
    analogue: "Analogue",
    dual: "Dual",
    equivalent: "Equivalent",
  };
