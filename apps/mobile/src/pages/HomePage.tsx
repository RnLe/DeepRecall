/**
 * Home/Landing Page
 */

export default function HomePage() {
  return (
    <div className="h-full flex items-center justify-center bg-gray-950">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">DeepRecall Mobile</h1>
        <p className="text-gray-400">Read once. Remember for years.</p>
        <div className="flex gap-4 justify-center mt-8">
          <a
            href="/library"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Go to Library
          </a>
        </div>
      </div>
    </div>
  );
}
