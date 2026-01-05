/**
 * Button component
 */

"use client";

import type { ReactNode, ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button content */
  children: ReactNode;
  /** Visual variant */
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether the button is in loading state */
  loading?: boolean;
  /** Icon to show before text */
  iconLeft?: ReactNode;
  /** Icon to show after text */
  iconRight?: ReactNode;
  /** Whether to render as full width */
  fullWidth?: boolean;
}

const variantClasses = {
  primary:
    "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/50 shadow-lg shadow-emerald-900/20",
  secondary: "bg-gray-700 hover:bg-gray-600 text-gray-100 border-gray-600/50",
  ghost: "bg-transparent hover:bg-gray-700/50 text-gray-300 border-transparent",
  danger: "bg-red-600/80 hover:bg-red-600 text-white border-red-500/50",
  success:
    "bg-emerald-600/80 hover:bg-emerald-600 text-white border-emerald-500/50",
};

const sizeClasses = {
  sm: "text-sm px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2 gap-2",
  lg: "text-base px-5 py-2.5 gap-2",
};

/**
 * Action button with multiple variants
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={clsx(
        "inline-flex items-center justify-center font-medium rounded-lg border transition-all duration-150",
        "focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-2 focus:ring-offset-gray-900",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        isDisabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : (
        iconLeft
      )}
      {children}
      {!loading && iconRight}
    </button>
  );
}
