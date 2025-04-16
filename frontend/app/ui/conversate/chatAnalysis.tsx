// ChatAnalysis.tsx
import React, { useState } from 'react';
import { ChatCompact, Speaker } from '../../types/diarizationTypes';
import { SpeakerData, SpeakerCard } from './speakerCard';

interface AnalysisResponse {
  summary: string;
  keynotes: { [speaker: string]: string[] };
}

interface ChatAnalysisProps {
  chatContent: ChatCompact;
  speakers?: Speaker[]; // Added new optional speakers prop
  containerClassName?: string;
  summaryClassName?: string;
  keynotesContainerClassName?: string;
  speakerClassName?: string;
  bulletPointClassName?: string;
  errorClassName?: string;
}

const ChatAnalysis: React.FC<ChatAnalysisProps> = ({
  chatContent,
  speakers, // destructuring new prop
  containerClassName = "",
  summaryClassName = "",
  keynotesContainerClassName = "",
  speakerClassName = "",
  errorClassName = "",
}) => {
  // State variables for analysis data, errors, and loading state
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Function to call the analysis endpoint
  const handleAnalyze = () => {
    if (!chatContent || !chatContent.segments || chatContent.segments.length === 0) {
      setError("No chat content available for analysis.");
      return;
    }
    setError(null);
    setLoading(true);

    // Transform segments for analysis endpoint
    const transformedTranscript = chatContent.segments.map(segment => ({
      speaker: segment.speakerName,
      text: segment.text,
    }));

    fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transcript: transformedTranscript }),
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((data) => {
            throw new Error(data.detail || "Error fetching analysis");
          });
        }
        return res.json();
      })
      .then((data: AnalysisResponse) => {
        setAnalysis(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  return (
    <div className={`p-6 rounded-lg shadow-md bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 ${containerClassName}`}>
      {/* Analyze Button */}
      <button
        className="px-4 w-full py-2 mb-4 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 rounded text-white disabled:opacity-50"
        onClick={handleAnalyze}
        disabled={!chatContent || !chatContent.segments || chatContent.segments.length === 0 || loading}
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>

      {/* Error Message */}
      {error && (
        <div className={`mt-2 p-2 bg-red-200 dark:bg-red-600 text-red-700 dark:text-red-100 rounded ${errorClassName}`}>
          Error: {error}
        </div>
      )}

      {/* Display Analysis */}
      {analysis && (
        <>
          {/* Analysis Summary Section */}
          <div className={`mt-4 p-4 border bg-slate-800 border-gray-200 dark:border-gray-700 rounded-md ${summaryClassName}`}>
            <h2 className="text-2xl font-bold mb-2">Summary</h2>
            <p>{analysis.summary}</p>
          </div>

          {/* Keynotes per Speaker Section */}
          <div className={`mt-4 ${keynotesContainerClassName}`}>
            <h2 className="text-2xl font-bold mb-2">Keynotes per Speaker</h2>
            {Object.entries(analysis.keynotes).map(([speakerName, notes]) => (
              <div key={speakerName} className={`flex items-start space-x-4 mb-4 min-h-40 ${speakerClassName} bg-slate-800 p-2 rounded-lg shadow-md`}>
                {/* Look up speaker by name */}
                {speakers && speakers.find(s => s.name === speakerName) ? (
                  <SpeakerCard 
                    speaker={speakers.find(s => s.name === speakerName)!} 
                    showName={true} 
                    className="w-20 h-20" 
                  />
                ) : (
                  <SpeakerData 
                    speakerId={speakerName} 
                    showName={true} 
                    className="w-20 h-20" 
                  />
                )}
                {/* Keynotes collection displayed as individual subtle cards */}
                <div className="flex flex-col space-y-2 flex-1">
                  {notes.map((note, idx) => (
                    <div key={idx} className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm">
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ChatAnalysis;
