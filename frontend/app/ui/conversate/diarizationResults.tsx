import React, { useState, useEffect } from 'react';

interface DiarizationResultsProps {
  convId: string;
}

const DiarizationResults: React.FC<DiarizationResultsProps> = ({ convId }) => {
  const [rttmContent, setRttmContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRttm = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/diarization-details/${convId}`);
        const data = await res.json();
        setRttmContent(data.content);
      } catch (error) {
        console.error("Failed to fetch RTTM details", error);
      }
      setLoading(false);
    };
    fetchRttm();
  }, [convId]);

  return (
    <div className="p-4 bg-gray-800 rounded text-white">
      <h2 className="text-xl font-bold">Diarization Results</h2>
      {loading ? (
        <p>Loading RTTM details...</p>
      ) : (
        <pre className="mt-2 bg-gray-900 p-2 rounded overflow-auto max-h-64 text-sm">
          {rttmContent || "No RTTM details available."}
        </pre>
      )}
    </div>
  );
};

export default DiarizationResults;