"use client";

/**
 * GitHub Device Code Modal
 *
 * Displays the user code that needs to be entered on GitHub
 * during the device code OAuth flow.
 */

import { useState, useEffect } from "react";

export interface GitHubDeviceCodeModalProps {
  isOpen: boolean;
  userCode: string;
  verificationUri: string;
  onCancel: () => void;
}

export function GitHubDeviceCodeModal({
  isOpen,
  userCode,
  verificationUri,
  onCancel,
}: GitHubDeviceCodeModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(userCode);
      setCopied(true);
    } catch (error) {
      console.error("[GitHubDeviceCodeModal] Failed to copy:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 relative border border-gray-700">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            GitHub Device Activation
          </h2>
          <p className="text-gray-400 text-sm">
            Enter this code on GitHub to continue
          </p>
        </div>

        {/* User Code Display */}
        <div className="bg-gray-900 rounded-lg p-4 mb-4 border border-gray-600">
          <p className="text-xs text-gray-400 mb-2 text-center">Your code</p>
          <div className="flex items-center justify-center gap-2">
            <code className="text-3xl font-mono font-bold text-white tracking-wider">
              {userCode}
            </code>
            <button
              onClick={handleCopyCode}
              className="p-2 hover:bg-gray-700 rounded transition-colors"
              title="Copy code"
            >
              {copied ? (
                <svg
                  className="w-5 h-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white">
              1
            </div>
            <p className="text-sm text-gray-300">
              The GitHub page is opening in your browser
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white">
              2
            </div>
            <p className="text-sm text-gray-300">
              Enter the code shown above when prompted
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white">
              3
            </div>
            <p className="text-sm text-gray-300">
              Authorize the app and return here
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <a
            href={verificationUri}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-center text-sm font-medium"
          >
            Open GitHub
          </a>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-sm font-medium"
          >
            Cancel
          </button>
        </div>

        <div className="mt-4 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <p className="text-xs">Waiting for authorization...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
