export default function ReaderPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">PDF Reader</h1>
        <p className="text-gray-400">
          PDF viewer with annotations coming soon...
        </p>
        <div className="text-sm text-gray-600">
          <p>Features:</p>
          <ul className="mt-2 space-y-1">
            <li>• PDF.js rendering</li>
            <li>• Normalized coordinate overlays</li>
            <li>• Highlight, rectangle, and note tools</li>
            <li>• Zustand for UI state</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
