import Link from "next/link";
import Image from "next/image";
import { BookOpen, Library, Brain } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-4xl w-full space-y-12">
        <header className="text-center space-y-6">
          <div className="flex items-center justify-center gap-6">
            <Image
              src="/favicon.ico"
              alt="DeepRecall Logo"
              width={80}
              height={80}
              className="w-20 h-20"
            />
            <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent pb-2">
              DeepRecall
            </h1>
          </div>
          <p className="text-xl text-gray-400">
            Read once. Remember for years.
          </p>
        </header>

        <nav className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/library"
            className="group p-8 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-500 transition-all duration-200"
          >
            <div className="flex flex-col items-center space-y-4">
              <Library className="w-12 h-12 text-blue-400 group-hover:scale-110 transition-transform" />
              <h2 className="text-2xl font-semibold">Library</h2>
              <p className="text-gray-400 text-center">
                Browse and manage your PDFs
              </p>
            </div>
          </Link>

          <Link
            href="/reader"
            className="group p-8 bg-gray-900 border border-gray-800 rounded-lg hover:border-purple-500 transition-all duration-200"
          >
            <div className="flex flex-col items-center space-y-4">
              <BookOpen className="w-12 h-12 text-purple-400 group-hover:scale-110 transition-transform" />
              <h2 className="text-2xl font-semibold">Reader</h2>
              <p className="text-gray-400 text-center">
                Annotate and study documents
              </p>
            </div>
          </Link>

          <Link
            href="/review"
            className="group p-8 bg-gray-900 border border-gray-800 rounded-lg hover:border-green-500 transition-all duration-200"
          >
            <div className="flex flex-col items-center space-y-4">
              <Brain className="w-12 h-12 text-green-400 group-hover:scale-110 transition-transform" />
              <h2 className="text-2xl font-semibold">Review</h2>
              <p className="text-gray-400 text-center">
                Daily SRS review session
              </p>
            </div>
          </Link>
        </nav>
      </div>
    </div>
  );
}
