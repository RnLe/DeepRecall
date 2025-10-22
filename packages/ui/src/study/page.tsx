"use client";

import { Brain } from "lucide-react";

export default function ReviewPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <Brain className="w-16 h-16 text-green-400 mx-auto" />
        <h1 className="text-4xl font-bold">Review Session</h1>
        <p className="text-gray-400">
          FSRS-powered spaced repetition coming soon...
        </p>
        <div className="text-sm text-gray-600">
          <p>Features:</p>
          <ul className="mt-2 space-y-1">
            <li>• Daily review queue</li>
            <li>• Keyboard-first grading (1-4)</li>
            <li>• Latency capture</li>
            <li>• Deep links to source annotations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
