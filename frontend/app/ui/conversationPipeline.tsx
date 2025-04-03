import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import StateStatusRow from './stateStatusRow';
import WhisperTranscription from './whisperTranscription';
import StateStatusRowClickable from './stateStatusRowClickable';

interface ConversationPipelineProps {
  convId: string;
  states?: {
    diarization: boolean;
    transcription: boolean;
    speakerAssignment: boolean;
    report: boolean;
    stats: boolean;
  };
}

const ConversationPipeline: React.FC<ConversationPipelineProps> = ({ convId, states }) => {
  const queryClient = useQueryClient(); // <-- Get the query client
  const [mediaType, setMediaType] = useState("audio");
  const [file, setFile] = useState<File | null>(null);
  const [authToken, setAuthToken] = useState("");
  const [uploadInfo, setUploadInfo] = useState<string>("");
  const [audioUploaded, setAudioUploaded] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cacheInvalidated, setCacheInvalidated] = useState(false); // <-- New state flag

  // When a file is selected, validate and immediately upload it.
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setAudioUploaded(false);
      setUploadInfo("Checking file...");
      const formData = new FormData();
      formData.append("conv_id", convId);
      formData.append("media_type", "audio");
      formData.append("file", selectedFile);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/upload_audio`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.status === "success") {
          setUploadInfo(data.message);
          setAudioUploaded(true);
        } else {
          setUploadInfo(data.message || "Upload failed.");
          setAudioUploaded(false);
        }
      } catch (error: any) {
        setUploadInfo("Upload error: " + error.message);
        setAudioUploaded(false);
      }
    }
  };

  // When "Start Diarization" is clicked, call the pipeline endpoint.
  const handleSubmit = async () => {
    if (!audioUploaded) {
      alert("Please upload a valid audio file first.");
      return;
    }
    if (!authToken) {
      alert("Please enter an auth token.");
      return;
    }
    setProgress([]);
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("conv_id", convId);
    formData.append("media_type", mediaType);
    formData.append("auth_token", authToken);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/pipeline`, {
        method: "POST",
        body: formData,
      });
      if (!response.body) {
        throw new Error("ReadableStream not supported in this browser.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);
        const messages = chunkValue.split("\n").filter((line) => line.trim() !== "");
        setProgress((prev) => [...prev, ...messages]);
      }
    } catch (error: any) {
      setProgress((prev) => [...prev, "Error: " + error.message]);
    }
    setIsProcessing(false);
  };

  // Effect: Invalidate cache when transcription is successful.
  useEffect(() => {
    if (cacheInvalidated) return;
    for (let msg of progress) {
      let parsed;
      try {
        parsed = JSON.parse(msg);
      } catch (e) {
        parsed = { message: msg };
      }
      if (
        parsed.status &&
        parsed.status.toLowerCase() === 'transcription' &&
        parsed.message.toLowerCase().includes('success')
      ) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        setCacheInvalidated(true);
        break;
      }
    }
  }, [progress, cacheInvalidated, queryClient]);

  return (
    <div className="p-4 bg-gray-800 rounded text-white space-y-4">
      <StateStatusRowClickable 
        convId={convId} 
        states={states || {
          diarization: false,
          transcription: false,
          speakerAssignment: false,
          report: false,
          stats: false
        }} 
      />
      <h2 className="text-xl font-bold">Conversation Pipeline</h2>
      <div>
        <label className="block text-sm font-medium">Select Media Type</label>
        <div className="mt-1 space-x-4">
          <label>
            <input
              type="radio"
              value="audio"
              checked={mediaType === "audio"}
              onChange={() => setMediaType("audio")}
              className="mr-1"
            />
            Audio
          </label>
          <label>
            <input
              type="radio"
              value="video"
              checked={mediaType === "video"}
              onChange={() => setMediaType("video")}
              className="mr-1"
            />
            Video (Placeholder)
          </label>
          <label>
            <input
              type="radio"
              value="youtube"
              checked={mediaType === "youtube"}
              onChange={() => setMediaType("youtube")}
              className="mr-1"
            />
            YouTube Link (Placeholder)
          </label>
        </div>
      </div>
      {mediaType === "audio" && (
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium">Upload Audio File (.wav or .mp3)</label>
            <input
              type="file"
              accept=".wav,.mp3"
              onChange={handleFileChange}
              className="mt-1 block w-full bg-gray-700 border border-gray-600 p-2 rounded"
            />
            {uploadInfo && <p className="mt-1 text-sm">{uploadInfo}</p>}
          </div>
          {audioUploaded && (
            <div className="text-green-500 text-2xl">
              &#10003;
            </div>
          )}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium">Auth Token</label>
        <input
          type="text"
          value={authToken}
          onChange={(e) => setAuthToken(e.target.value)}
          placeholder="Enter HF auth token"
          className="mt-1 block w-full bg-gray-700 border border-gray-600 p-2 rounded"
        />
      </div>
      <div>
        <button
          onClick={handleSubmit}
          disabled={isProcessing}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded"
        >
          {isProcessing ? "Processing..." : "Start Diarization"}
        </button>
      </div>
      <div className="mt-4">
        <h3 className="text-lg font-semibold">Progress:</h3>
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
                {parsed.device && <span> (Device: {parsed.device})</span>}
              </div>
            );
          })}
        </div>
      </div>
      <WhisperTranscription convId={convId} />
    </div>
  );
};

export default ConversationPipeline;
