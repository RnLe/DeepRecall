/**
 * IconButton component for icon-only actions
 */

"use client";

import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Visual variant */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Accessible label (required for accessibility) */
  title: string;
}

const variantClasses = {
  primary: "bg-emerald-600/80 hover:bg-emerald-500 text-white",
  secondary: "bg-gray-700/80 hover:bg-gray-600 text-gray-200",
  ghost:
    "bg-transparent hover:bg-gray-700/50 text-gray-400 hover:text-gray-200",
  danger: "bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300",
};

const sizeClasses = {
  sm: "p-1.5",
  md: "p-2",
  lg: "p-2.5",
};

const iconSizes = {
  sm: 14,
  md: 18,
  lg: 22,
};

/**
 * Icon-only button for compact actions
 */
export function IconButton({
  icon: Icon,
  variant = "ghost",
  size = "md",
  title,
  disabled,
  className = "",
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={title}
      className={clsx(
        "inline-flex items-center justify-center rounded-lg transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-emerald-500/40",
        variantClasses[variant],
        sizeClasses[size],
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...props}
    >
      <Icon size={iconSizes[size]} />
    </button>
  );
}
