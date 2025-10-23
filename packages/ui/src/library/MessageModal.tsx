/**
 * MessageModal Component (Platform-Agnostic)
 *
 * Reusable modal for confirmations and alerts
 */

import { X } from "lucide-react";

export interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "info" | "warning" | "danger";
}

export function MessageModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  variant = "info",
}: MessageModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    info: "bg-blue-900/30 text-blue-300 border-blue-700/50 hover:bg-blue-900/50",
    warning:
      "bg-amber-900/30 text-amber-300 border-amber-700/50 hover:bg-amber-900/50",
    danger:
      "bg-rose-900/30 text-rose-300 border-rose-700/50 hover:bg-rose-900/50",
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      style={{ zIndex: 9999 }}
    >
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl max-w-md w-full relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-700">
          <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-neutral-300 text-sm leading-relaxed whitespace-pre-wrap">
            {message}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-neutral-700 bg-neutral-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            {cancelText}
          </button>
          {onConfirm && (
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`px-4 py-2 text-sm font-medium border rounded transition-colors ${variantStyles[variant]}`}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
