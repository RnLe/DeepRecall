// conversationPipeline.tsx

import React, { useState, useEffect, useRef } from 'react';
import { secondsToString } from '../helpers/timesToString';
import { hardwareResponse, Conversation } from '../helpers/diarizationTypes';
import { useActiveConversation } from '../context/activeConversationContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchConversationDetails } from '../api/conversationApi';
import { StatusBar, StatusType } from './statusBar';
import { HardwareBanner } from './hardwareBanner';
import { TokenModal } from './tokenModal';
import { formatLogMessage, formatReadableDateTime } from '../helpers/logHelpers';
import { DiarizationResult, parseRTTM } from '../helpers/diarizationHelpers';

const ConversationPipeline: React.FC = () => {
  const { activeConversation, setActiveConversation } = useActiveConversation();

  const { data: conversationDetails, isLoading, error, refetch } = useQuery<Conversation>({
    queryKey: ['conversation', activeConversation?.id],
    queryFn: () => fetchConversationDetails(activeConversation!.id),
    enabled: !!activeConversation?.id,
  });
  
  const [selectedStatus, setSelectedStatus] = useState<StatusType>('media');
  const [file, setFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [uploadWarning, setUploadWarning] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [serverMetadata, setServerMetadata] = useState<{ file_size_bytes: number; duration_sec: number; file_type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Diarization process state
  const [isDiarizationProcessing, setIsDiarizationProcessing] = useState(false);
  const [diarizationElapsed, setDiarizationElapsed] = useState<number>(0);
  const [diarizationLogs, setDiarizationLogs] = useState<string[]>([]);
  const diarizationTimerRef = useRef<number | null>(null);
  const diarizationProcessingRef = useRef(false);

  // New: Diarization results from RTTM file
  const [diarizationResults, setDiarizationResults] = useState<DiarizationResult[]>([]);

  const [hfToken, setHfToken] = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [hfTokenInput, setHfTokenInput] = useState<string>("");
  const [tokenMessage, setTokenMessage] = useState<string>("");

  // Fetch token info on mount
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/apitokens`)
      .then((res) => res.json())
      .then((data) => {
        // Assuming tokens is an object with keys e.g., "Hugging Face"
        setHfToken(data.tokens["Hugging Face"]);
      })
      .catch((err) => console.error("Failed to load API tokens", err));
  }, []);

  useEffect(() => {
    if (conversationDetails) {
      // Update your context's activeConversation with the new data
      setActiveConversation(conversationDetails);
    }
  }, [conversationDetails, setActiveConversation]);

  // Handler for file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setUploadWarning('');
      const objectUrl = URL.createObjectURL(selected);
      const audioEl = new Audio(objectUrl);
      audioEl.onloadedmetadata = () => {
        setAudioDuration(audioEl.duration);
      };
    }
  };

  const isValidAudio = file
    ? (file.name.toLowerCase().endsWith('.mp3') || file.name.toLowerCase().endsWith('.wav'))
    : false;

  // Upload the audio file to the server
  const handleUpload = async () => {
    if (!file || !activeConversation) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('conv_id', activeConversation.id);
    formData.append('media_type', 'audio');
    formData.append('file', file);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/upload_audio`, {
        method: 'POST',
        body: formData,
      });
      const response = await res.json();
      if (response.message && response.message.includes("Warning")) {
        setUploadWarning(response.message);
      } else {
        setUploadWarning('');
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        // Refresh server metadata.
        fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/audio-metadata/${activeConversation.id}`)
          .then((res) => res.json())
          .then((data) => setServerMetadata(data))
          .catch((err) => console.error('Failed to fetch audio metadata', err));
        // Trigger refetch to update conversation details.
        refetch();
      }
    } catch (error) {
      console.error('Upload failed', error);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!file && conversationDetails && conversationDetails.diarizationProcess?.timeStarted) {
      fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/audio-metadata/${activeConversation?.id}`)
        .then((res) => res.json())
        .then((data) => setServerMetadata(data))
        .catch((err) => console.error('Failed to fetch audio metadata', err));
    }
  }, [file, conversationDetails, activeConversation]);

  useEffect(() => {
    if (activeConversation?.id) {
      fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/audio-metadata/${activeConversation.id}`)
        .then((res) => res.json())
        .then((data) => setServerMetadata(data))
        .catch((err) => console.error('Failed to fetch audio metadata', err));
    }
  }, [activeConversation]);

  // Diarization: start the process and stream server responses.
  const handleStartDiarization = async () => {
    setIsDiarizationProcessing(true);
    diarizationProcessingRef.current = true;
    const startTime = Date.now();
    setDiarizationLogs([]);
    
    // Update timer using requestAnimationFrame for fast refresh.
    const updateTimer = () => {
      const newElapsed = (Date.now() - startTime) / 1000;
      setDiarizationElapsed(newElapsed);
      if (diarizationProcessingRef.current) {
        diarizationTimerRef.current = requestAnimationFrame(updateTimer);
      }
    };
    // Start the timer
    diarizationTimerRef.current = requestAnimationFrame(updateTimer);
    
    try {
      const formData = new FormData();
      formData.append('conv_id', activeConversation!.id);
      formData.append('media_type', 'audio');
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/diarize`, {
        method: 'POST',
        body: formData,
      });
      if (!res.body) throw new Error("ReadableStream not supported.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value);
        const messages = chunk.split("\n").filter(line => line.trim() !== "");
        // Apply formatting to each message
        setDiarizationLogs(prev => [...prev, ...messages.map(formatLogMessage)]);
      }
    } catch (error: any) {
      setDiarizationLogs(prev => [...prev, `❌ Error: ${error.message}`]);
    } finally {
      setIsDiarizationProcessing(false);
      diarizationProcessingRef.current = false;
      if (diarizationTimerRef.current)
        cancelAnimationFrame(diarizationTimerRef.current);
      // Trigger refetch to update conversation status after diarization.
      refetch();
    }
  };

  // New: Fetch and format diarization results from the RTTM file.
  const handleFetchResults = async () => {
    if (!activeConversation) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/diarization-details/${activeConversation.id}`
      );
      if (!res.ok) {
        throw new Error("Failed to fetch diarization details");
      }
      const rawText = await res.text();
      const results = parseRTTM(rawText);
      setDiarizationResults(results);
    } catch (error: any) {
      console.error("Error fetching diarization results:", error.message);
    }
  };

  const hasAudio = !!activeConversation?.states.audioAvailable;

  // Decide which logs to display: if processing, show local logs; else, show past logs if valid.
  const displayedLogs = isDiarizationProcessing
    ? diarizationLogs
    : (activeConversation?.diarizationProcess && activeConversation.diarizationProcess.timeStarted > 0
        ? activeConversation.diarizationProcess.logs
        : []);

  // Determine button label based on whether a valid diarization has been done.
  const diarizationButtonLabel =
    activeConversation?.diarizationProcess && activeConversation.diarizationProcess.timeStarted > 0
      ? (isDiarizationProcessing ? 'Diarization in Progress...' : 'Restart Diarization')
      : 'Start Diarization';

  return (
    <div className="p-4 bg-gray-800 rounded text-white space-y-4">
      {/* Status bar */}
      <StatusBar
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        states={{
          audioAvailable: !!activeConversation?.states.audioAvailable,
          diarization: !!activeConversation?.states.diarization,
          transcript: !!activeConversation?.states.transcript,
          speakerAssignment: !!activeConversation?.states.speakerAssignment,
        }}
        file={file}
      />

      {/* Content area switching based on selected status */}
      <div className="mt-4">
        {selectedStatus === 'media' && (
          <div>
            <h3 className="text-lg font-bold mb-2">Media Details</h3>
            {file ? (
              <div>
                <p>Size: {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                <p>Duration: {audioDuration ? secondsToString(audioDuration) : 'Loading...'}</p>
                {file.name.toLowerCase().endsWith('.mp3') && (
                  <p className="text-yellow-400">Warning: mp3 format may have limitations.</p>
                )}
              </div>
            ) : activeConversation?.states.audioAvailable ? (
              <div className="p-4 bg-gray-700 rounded mb-2">
                <p className='text-green-500'>Audio is available on the server.</p>
                {serverMetadata ? (
                  <p>
                    Size: {(serverMetadata.file_size_bytes / (1024 * 1024)).toFixed(2)} MB, Duration:{' '}
                    {secondsToString(serverMetadata.duration_sec)}, Format: {serverMetadata.file_type}
                  </p>
                ) : (
                  <p>Loading audio metadata...</p>
                )}
              </div>
            ) : (
              <p>No media provided.</p>
            )}
            <input
              type="file"
              accept=".wav,.mp3"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="mt-2 p-2 bg-gray-700 border border-gray-600 rounded"
            />
            <button
              onClick={handleUpload}
              disabled={!file || !isValidAudio || uploading}
              className={`mt-2 p-2 rounded ml-2 ${
                file && isValidAudio ? 'bg-green-600 cursor-pointer' : 'bg-gray-600 cursor-not-allowed'
              }`}
            >
              {uploading ? 'Uploading...' : 'Upload Audio'}
            </button>
            {uploadWarning && <p className="mt-2 text-yellow-400">{uploadWarning}</p>}
          </div>
        )}

        {(selectedStatus === 'diarization' || selectedStatus === 'transcription') && (
          <div>
            <HardwareBanner />
          </div>
        )}

        {selectedStatus === 'diarization' && (
          <div>
            <h3 className="text-lg font-bold mb-2">Diarization</h3>
            {/* Hugging Face token field */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-bold">Hugging Face Token:</label>
                {hfToken ? (
                  <span className="text-green-400">{hfToken}</span>
                ) : (
                  <span className="text-yellow-400">No token provided.</span>
                )}
              </div>
              <button
                onClick={() => setShowTokenModal(true)}
                className="px-3 py-1 bg-blue-500 rounded"
              >
                Change Token
              </button>
            </div>
            {/* Merged view for past and in-progress diarization */}
            {(activeConversation?.diarizationProcess?.timeStarted > 0 || isDiarizationProcessing) ? (
              <div>
                <div className="mb-4">
                  <p>
                    <strong>Processing Device:</strong> {activeConversation?.diarizationProcess?.device || 'N/A'}
                  </p>
                  <p>
                    <strong>Started:</strong>{' '}
                    {activeConversation?.diarizationProcess
                      ? formatReadableDateTime(activeConversation.diarizationProcess.timeStarted)
                      : "N/A"}
                  </p>
                  <p>
                    {isDiarizationProcessing
                      ? `Elapsed Time: ${diarizationElapsed.toFixed(3)} seconds`
                      : activeConversation?.diarizationProcess?.timeCompleted
                        ? `Duration: ${secondsToString(activeConversation.diarizationProcess.timeCompleted - activeConversation.diarizationProcess.timeStarted)}`
                        : ''}
                  </p>
                </div>
                <div className="mt-2 p-2 bg-gray-900 rounded h-40 overflow-y-auto font-mono text-xs">
                  {displayedLogs.map((log, index) => (
                    <p key={index}>{formatLogMessage(log)}</p>
                  ))}
                </div>
                <button
                  onClick={() => {
                    if (window.confirm("Warning: restarting diarization will overwrite existing data. Continue?")) {
                      // Clear local logs so stale logs are not shown.
                      setDiarizationLogs([]);
                      handleStartDiarization();
                    }
                  }}
                  disabled={!hasAudio || isDiarizationProcessing}
                  className="mt-2 p-2 bg-blue-500 hover:bg-blue-600 rounded"
                >
                  {diarizationButtonLabel}
                </button>
                {/* New: Button to fetch and display RTTM results */}
                <button
                  onClick={handleFetchResults}
                  disabled={!activeConversation}
                  className="mt-2 p-2 bg-purple-500 hover:bg-purple-600 rounded ml-2"
                >
                  Fetch Results
                </button>
                {diarizationResults.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-lg font-bold mb-2">Diarization Results</h4>
                    <table className="min-w-full divide-y divide-gray-700">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left">Start Time</th>
                          <th className="px-4 py-2 text-left">Duration</th>
                          <th className="px-4 py-2 text-left">Speaker</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diarizationResults.map((result, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2">{secondsToString(result.startTime)}</td>
                            <td className="px-4 py-2">{secondsToString(result.duration)}</td>
                            <td className="px-4 py-2">{result.speaker}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleStartDiarization}
                disabled={!hasAudio}
                className="p-2 bg-blue-500 hover:bg-blue-600 rounded"
              >
                Start Diarization
              </button>
            )}
          </div>
        )}

        {selectedStatus === 'transcription' && (
          <div>
            <h3 className="text-lg font-bold mb-2">Transcription</h3>
            {activeConversation?.states.transcript ? (
              <p>Transcription already completed.</p>
            ) : (
              <p>Transcription process placeholder.</p>
            )}
          </div>
        )}

        {selectedStatus === 'speakerAssignment' && (
          <div>
            <h3 className="text-lg font-bold mb-2">Speaker Assignment</h3>
            <p>{activeConversation?.states.speakerAssignment ? 'Speakers assigned.' : 'Speakers not assigned yet.'}</p>
          </div>
        )}

        {selectedStatus === 'chat' && (
          <div>
            <h3 className="text-lg font-bold mb-2">Chat</h3>
            <p>
              {activeConversation?.states.diarization && activeConversation?.states.transcript
                ? 'Chat available. (It is suggested to complete speaker assignment first.)'
                : 'Chat not available yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Modal for providing token */}
      {showTokenModal && (
        <TokenModal
          hfToken={hfToken}
          hfTokenInput={hfTokenInput}
          tokenMessage={tokenMessage}
          setHfTokenInput={setHfTokenInput}
          setTokenMessage={setTokenMessage}
          setShowTokenModal={setShowTokenModal}
          setHfToken={setHfToken}
        />
      )}
    </div>
  );
};

export default ConversationPipeline;
