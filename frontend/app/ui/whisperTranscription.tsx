// whisperTranscription.tsx
import React, { useState, useEffect } from 'react';

interface WhisperTranscriptionProps {
  convId: string;
}

const WhisperTranscription: React.FC<WhisperTranscriptionProps> = ({ convId }) => {
  // State for storing available Whisper models.
  const [models, setModels] = useState<string[]>([]);
  // Default selected model.
  const [selectedModel, setSelectedModel] = useState<string>("large-v3-turbo");
  // Progress messages from the backend.
  const [progress, setProgress] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch available models from the backend when the component mounts.
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/whisper/models`);
        const data = await res.json();
        setModels(data.models);
      } catch (error) {
        console.error("Error fetching whisper models", error);
      }
    };
    fetchModels();
  }, []);

  // Handle the transcription process.
  const handleTranscription = async () => {
    setProgress([]);
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("conv_id", convId);
    formData.append("model_string", selectedModel);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/transcribe`, {
        method: "POST",
        body: formData,
      });
      if (!response.body) {
        throw new Error("ReadableStream not supported in this browser.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      // Read the streaming response.
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        // Split chunk into individual JSON lines.
        const messages = chunkValue.split("\n").filter((line) => line.trim() !== "");
        setProgress((prev) => [...prev, ...messages]);
      }
    } catch (error: any) {
      setProgress((prev) => [...prev, "Error: " + error.message]);
    }
    setIsProcessing(false);
  };

  return (
    <div className="p-4 bg-gray-800 rounded text-white space-y-4 mt-4">
      <h2 className="text-xl font-bold">Whisper Transcription</h2>
      <div>
        <label className="block text-sm font-medium">Select Whisper Model</label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="mt-1 block w-full bg-gray-700 border border-gray-600 p-2 rounded"
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>
      <div>
        <button
          onClick={handleTranscription}
          disabled={isProcessing}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded"
        >
          {isProcessing ? "Transcribing..." : "Start Transcription"}
        </button>
      </div>
      <div>
        <h3 className="text-lg font-semibold">Transcription Progress:</h3>
        <div className="max-h-64 overflow-y-auto bg-gray-900 p-2 rounded border border-gray-700">
          {progress.map((msg, index) => {
            let parsed;
            try {
              parsed = JSON.parse(msg);
            } catch (e) {
              parsed = { message: msg };
            }
            return (
              <div key={index} className="text-sm">
                <strong>{parsed.status ? parsed.status.toUpperCase() : ""}</strong>: {parsed.message}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WhisperTranscription;
