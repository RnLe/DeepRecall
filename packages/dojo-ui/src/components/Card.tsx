/**
 * Card component for content containers
 */

"use client";

import type { ReactNode, HTMLAttributes } from "react";
import clsx from "clsx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card content */
  children: ReactNode;
  /** Visual variant */
  variant?: "default" | "elevated" | "outlined" | "ghost";
  /** Padding size */
  padding?: "none" | "sm" | "md" | "lg";
  /** Whether the card is interactive (adds hover state) */
  interactive?: boolean;
  /** Whether to add a subtle glow effect */
  glow?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const variantClasses = {
  default: "bg-gray-800/60 border border-gray-700/50",
  elevated:
    "bg-gray-800/80 border border-gray-700/60 shadow-lg shadow-black/20",
  outlined: "bg-transparent border border-gray-700",
  ghost: "bg-transparent",
};

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

/**
 * Container card for content sections
 */
export function Card({
  children,
  variant = "default",
  padding = "md",
  interactive = false,
  glow = false,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl",
        variantClasses[variant],
        paddingClasses[padding],
        interactive &&
          "cursor-pointer transition-all duration-200 hover:bg-gray-700/60 hover:border-gray-600/60",
        glow && "ring-1 ring-emerald-500/10",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Card sub-components for composition
export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center justify-between mb-3", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={clsx("text-lg font-semibold text-gray-100", className)}>
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <p className={clsx("text-sm text-gray-400", className)}>{children}</p>;
}

export function CardContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2 mt-4 pt-3 border-t border-gray-700/50",
        className
      )}
    >
      {children}
    </div>
  );
}
