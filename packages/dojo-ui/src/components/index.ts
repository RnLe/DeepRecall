/**
 * Shared Dojo UI components
 */

export { Timer, type TimerProps, type TimerState } from "./Timer";
export { MathRenderer, type MathRendererProps } from "./MathRenderer";
export { Badge, type BadgeProps, type BadgeVariant } from "./Badge";
export { ProgressRing, type ProgressRingProps } from "./ProgressRing";
export { Card, type CardProps } from "./Card";
export { Button, type ButtonProps } from "./Button";
export { IconButton, type IconButtonProps } from "./IconButton";

// Domain taxonomy badges
export {
  ConceptKindBadge,
  ConceptKindIcon,
  type ConceptKindBadgeProps,
  CONCEPT_KIND_ICON,
  CONCEPT_KIND_COLORS,
} from "./ConceptKindBadge";
export {
  ExerciseKindBadge,
  ExerciseKindIcon,
  type ExerciseKindBadgeProps,
  EXERCISE_KIND_ICON,
  EXERCISE_KIND_COLORS,
} from "./ExerciseKindBadge";
export {
  DomainPathBadge,
  DisciplineIcon,
  DomainBreadcrumb,
  type DomainPathBadgeProps,
  DISCIPLINE_ICON,
  DISCIPLINE_COLORS,
} from "./DomainPathBadge";
export {
  ConceptKindFilter,
  ConceptKindFilterCompact,
  type ConceptKindFilterProps,
} from "./ConceptKindFilter";
