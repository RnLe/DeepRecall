// conversationPipeline.tsx

import React, { useState, useEffect, useRef } from 'react';
import { secondsToString } from '../../helpers/timesToString';
import { Conversation } from '../../helpers/diarizationTypes';
import { useActiveConversation } from '../../context/activeConversationContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchConversationDetails } from '../../api/conversationApi';
import { StatusBar, StatusType } from './statusBar';
import { TokenModal } from './tokenModal';
import { formatLogMessage, formatReadableDateTime } from '../../helpers/logHelpers';
import { DiarizationResult, parseRTTM, extractSpeakerCount, getSpeakerAudioFilename } from '../../helpers/diarizationHelpers';
import { SpeakerTimeline } from './speakerTimeline';
import { SpeakerCard } from './speakerCard';
import { Speaker } from '../../helpers/diarizationTypes';
import ReactModal from 'react-modal'; // added for modal support
import { getBlockTranscription, getLineTranscription } from '../../helpers/transcriptionHelpers';
import { parseChatContent, formatChatContentForClipboard, createChatCompact } from '../../helpers/chatHelpers';
import { ChatContent } from '../../helpers/diarizationTypes';
import Chat from './chat';
import ChatAnalysis from './chatAnalysis';


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

  // New: Diarization results from RTTM file.
  const [diarizationResults, setDiarizationResults] = useState<DiarizationResult[]>([]);
  const [speakerCount, setSpeakerCount] = useState<number>(0);

  const [hfToken, setHfToken] = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [hfTokenInput, setHfTokenInput] = useState<string>("");
  const [tokenMessage, setTokenMessage] = useState<string>("");

  const [showTable, setShowTable] = useState(false);

  // New state for speaker assignments (mapping diarization speaker label → assigned speaker id)
  const [assignedSpeakers, setAssignedSpeakers] = useState<{ [key: string]: string }>({});
  // State for modal to select a speaker for a given diarization speaker label
  const [showSpeakerSelectModal, setShowSpeakerSelectModal] = useState(false);
  const [currentDiarSpeaker, setCurrentDiarSpeaker] = useState<string>("");
  // Fetch available speakers from backend
  const { data: availableSpeakers } = useQuery<Speaker[]>({
    queryKey: ['speakers'],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/speakers`);
      const data = await res.json();
      return data.speakers;
    }
  });
  // Fetch speaker audios for assigned speakers
  const [speakerAudios, setSpeakerAudios] = useState<{ [key: string]: { audio_file: string; duration: number } }>(
    {}
  );
  useEffect(() => {
    if (activeConversation?.id && activeConversation.states?.diarization) {
      fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/speaker-audios/${activeConversation.id}`)
        .then(res => res.json())
        .then((data) => {
          const audios: { [key: string]: { audio_file: string; duration: number } } = {};
          if (data && Array.isArray(data.speaker_audios)) {
            data.speaker_audios.forEach((entry: any) => {
              audios[entry.speaker] = { audio_file: entry.audio_file, duration: entry.duration };
            });
          }
          setSpeakerAudios(audios);
        })
        .catch(err => console.error("Failed to fetch speaker audios", err));
    } else {
      setSpeakerAudios({}); // Reset speaker audios if not available
    }
  }, [activeConversation]);
  // Initialize assigned speakers from conversationDetails if available
  useEffect(() => {
    if (conversationDetails && conversationDetails.speakers) { // removed dependency on diarizationResults
      const fixedLabels = Array.from({ length: conversationDetails.speakerCount }, (_, i) => `SPEAKER_${i < 10 ? `0${i}` : i}`);
      const mapping: { [key: string]: string } = {};
      fixedLabels.forEach((label, idx) => {
        mapping[label] = conversationDetails.speakers[idx] || "";
      });
      setAssignedSpeakers(mapping);
    }
  }, [conversationDetails]);
  
  // Handler when a speaker is selected from modal
  const handleSpeakerSelect = (selected: Speaker) => {
    // Use the speaker label key (e.g., "SPEAKER_00")
    const label = currentDiarSpeaker;  
    const isAlreadyAssigned = Object.entries(assignedSpeakers).some(
      ([lbl, speakerId]) => speakerId === selected.id && lbl !== label
    );
    if (isAlreadyAssigned) {
      alert("This speaker is already assigned. Please choose a different speaker.");
      return;
    }
    const newMapping = { ...assignedSpeakers, [label]: selected.id };
    setAssignedSpeakers(newMapping);
    setShowSpeakerSelectModal(false);
  };

  const queryClient = useQueryClient(); // <-- add queryClient

  // New function to update the speaker assignment via API.
  const handleUpdateSpeakerAssignment = () => {
    if (activeConversation) {
      const fixedLabels = Array.from({ length: speakerCount }, (_, i) => `SPEAKER_${i < 10 ? `0${i}` : i}`);
      const speakersList = fixedLabels.map(lbl => assignedSpeakers[lbl] || "").join(",");
      const formData = new FormData();
      formData.append('speakers', speakersList);
      formData.append('conv_id', activeConversation.id);
      fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/${activeConversation.id}/update-speakers`, {
        method: 'PUT',
        body: formData,
      })
      .then(res => res.json())
      .then(data => {
        console.log("Updated assignment:", data);
        refetch(); // Refresh active conversation details
        queryClient.invalidateQueries({ queryKey: ['conversations'] }); // Invalidate parent conversation list cache
      })
      .catch(err => console.error("Failed to update speakers", err));
    }
  };

  // Fetch token info on mount.
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
      // Update your context's activeConversation with the new data.
      setActiveConversation(conversationDetails);
    }
  }, [conversationDetails, setActiveConversation]);

  // Handler for file selection.
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

  // Upload the audio file to the server.
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
    if (activeConversation?.id && activeConversation.states?.audioAvailable) {
      fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/audio-metadata/${activeConversation.id}`)
        .then((res) => res.json())
        .then((data) => setServerMetadata(data))
        .catch((err) => console.error('Failed to fetch audio metadata', err));
    } else {
      setServerMetadata(null); // Reset metadata if audio is not available
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
    // Start the timer.
    diarizationTimerRef.current = requestAnimationFrame(updateTimer);
  
    try {
      // Prepare the form data with necessary fields.
      const formData = new FormData();
      formData.append('conv_id', activeConversation.id);
      formData.append('media_type', 'audio');
      // Append num_speakers field: if user knows number & entered > 0, send that; otherwise send 0.
      formData.append('num_speakers', (!isNumSpeakerUnknown && numSpeakers > 0) ? numSpeakers.toString() : '0');
  
      // Send the POST request.
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/diarize`, {
        method: 'POST',
        body: formData,
      });
  
      if (!res.body) throw new Error("ReadableStream not supported.");
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
  
      // Continuously read chunks from the stream.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the current chunk and split into lines.
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(line => line.trim() !== "");

        // For each line, parse the JSON then pass the object to your format function.
        const formattedMessages = lines.map(line => {
          try {
            const messageObj = JSON.parse(line);
            return formatLogMessage(messageObj);
          } catch (e) {
            console.error("JSON parse error:", e, "Line:", line);
            return line; // Fallback: return the raw line if JSON.parse fails.
          }
        });

      // Append the formatted messages to the logs state.
      setDiarizationLogs(prev => [...prev, ...formattedMessages]);
      }
    } catch (error) {
      setDiarizationLogs(prev => [...prev, `❌ Error: ${error.message}`]);
    } finally {
      // Update the processing flag and refresh conversation status.
      setIsDiarizationProcessing(false);
      refetch();
    }
  };
  

  // New: Fetch and format diarization results from the RTTM file.
  const handleFetchResults = async () => {
    if (!activeConversation || !activeConversation.states?.diarization) {
      console.warn("Diarization results are not available yet.");
      return;
    }
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
      setSpeakerCount(extractSpeakerCount(rawText));
      setShowResults(true);
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

  // Analogous for the transcription process, but by using a effect
  useEffect(() => {
    if (activeConversation && activeConversation?.states?.transcript) {
      setTranscriptionLogs(activeConversation.transcriptionProcess.logs);
    }
  }, [activeConversation?.states?.transcript]);

  // Determine button label based on whether a valid diarization has been done.
  const diarizationButtonLabel =
    activeConversation?.states?.diarization
      ? (isDiarizationProcessing ? 'Diarization in Progress...' : 'Restart Diarization')
      : 'Start Diarization';

  // Compute a total duration for the timeline: use the maximum of the audio duration and the maximum of (startTime+duration) from results.
  const computedDuration = diarizationResults.reduce((max, r) => Math.max(max, r.startTime + r.duration), 0);
  const totalDuration = audioDuration > computedDuration ? audioDuration : computedDuration;

  const [showResults, setShowResults] = useState(false);

  // New: Transcription process state (similar to diarization)
  const [isTranscriptionProcessing, setIsTranscriptionProcessing] = useState(false);
  const [transcriptionElapsed, setTranscriptionElapsed] = useState<number>(0);
  const [transcriptionLogs, setTranscriptionLogs] = useState<string[]>([]);
  const transcriptionTimerRef = useRef<number | null>(null);
  const transcriptionProcessingRef = useRef(false);

  // New: Handler to initiate transcription process
  const handleStartTranscription = async () => {
    setIsTranscriptionProcessing(true);
    transcriptionProcessingRef.current = true;
    const startTime = Date.now();
    setTranscriptionLogs([]);

    // Update timer using requestAnimationFrame for fast refresh.
    const updateTimer = () => {
      const newElapsed = (Date.now() - startTime) / 1000;
      setTranscriptionElapsed(newElapsed);
      if (transcriptionProcessingRef.current) {
        transcriptionTimerRef.current = requestAnimationFrame(updateTimer);
      }
    };
    transcriptionTimerRef.current = requestAnimationFrame(updateTimer);

    try {
      // Prepare the form data.
      const formData = new FormData();
      formData.append('conv_id', activeConversation.id);
      formData.append('model_string', 'large-v3-turbo'); // change as needed

      // Send the POST request.
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/transcribe`, {
        method: 'POST',
        body: formData,
      });
      if (!res.body) throw new Error("ReadableStream not supported.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      // Process the stream.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the current chunk and split by newlines.
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(line => line.trim() !== "");

        // For each line, parse the JSON and format the message.
        const formattedMessages = lines.map(line => {
          try {
            const messageObj = JSON.parse(line);
            return formatLogMessage(messageObj);
          } catch (e) {
            console.error("JSON parse error:", e, "Line:", line);
            return line; // Fallback returns the raw line.
          }
        });

        // Append the formatted messages to the transcription logs.
        setTranscriptionLogs(prev => [...prev, ...formattedMessages]);
      }
    } catch (error) {
      setTranscriptionLogs(prev => [...prev, `❌ Error: ${error.message}`]);
    } finally {
      setIsTranscriptionProcessing(false);
      transcriptionProcessingRef.current = false;
      if (transcriptionTimerRef.current)
        cancelAnimationFrame(transcriptionTimerRef.current);
      refetch();
    }
  };


  // New: Handler to fetch and show transcription modal
  const handleShowTranscription = async () => {
    if (!activeConversation) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/transcription-details/${activeConversation.id}`);
      const data = await res.json();
      setTranscriptionData(data);
      setShowTranscriptionModal(true);
    } catch (error) {
      console.error("Failed to fetch transcription", error);
    }
  };

  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
  const [transcriptionData, setTranscriptionData] = useState<any>(null);
  const [transcriptionViewMode, setTranscriptionViewMode] = useState<'block' | 'line'>('block');

  const [chatContent, setChatContent] = useState<ChatContent | null>(null);
  const canCreateChat = activeConversation?.states?.diarization && activeConversation?.states?.transcript && activeConversation?.states?.speakerAssignment;

  // New handler to fetch diarization and transcription details and merge them.
  const handleFetchChat = async () => {
    if (!activeConversation) return;
    try {
      const [diagRes, transRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/diarization-details/${activeConversation.id}`).then(res => res.text()),
        fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/transcription-details/${activeConversation.id}`).then(res => res.json())
      ]);
      // Parse diarization data using the existing helper from diarizationHelpers.ts
      const diagResults = parseRTTM(diagRes);
      // transRes assumed to be a valid WhisperTranscription
      const chat = parseChatContent(diagResults, transRes, activeConversation.speakers);
      setChatContent(chat);
    } catch (error: any) {
      console.error("Error fetching chat data:", error.message);
    }
  };

  const handleCopyChat = () => {
    if (chatContent) {
      const formatted = formatChatContentForClipboard(chatContent);
      navigator.clipboard.writeText(formatted);
      alert('Chat copied to clipboard!');
    }
  };

  useEffect(() => {
    if (activeConversation?.states?.diarization && !showResults) {
      handleFetchResults();
    }
  }, [activeConversation?.states?.diarization, showResults]);

  const [showDiarizationModal, setShowDiarizationModal] = useState(false);

  // New state for number of speakers input and toggle.
  const [isNumSpeakerUnknown, setIsNumSpeakerUnknown] = useState<boolean>(true);
  const [numSpeakers, setNumSpeakers] = useState<number>(0);

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
            <h3 className="text-2xl font-bold mb-2">Media Details</h3>
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
              <p>No media provided. Please upload an audio file to proceed.</p>
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

        {selectedStatus === 'diarization' && (
          <div>
            <h3 className="text-2xl font-bold mb-2">Diarization</h3>
            {activeConversation?.states.audioAvailable ? (
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
                {/* New: Input for number of speakers */}
                <div className="mb-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isNumSpeakerUnknown}
                      onChange={(e) => setIsNumSpeakerUnknown(e.target.checked)}
                      className="form-checkbox text-blue-500"
                    />
                    <span>Don't know the number of speakers</span>
                  </label>
                  {!isNumSpeakerUnknown && (
                    <input
                      type="number"
                      min="1"
                      placeholder="Enter number of speakers"
                      value={numSpeakers > 0 ? numSpeakers : ''}
                      onChange={(e) => setNumSpeakers(parseInt(e.target.value) || 0)}
                      className="mt-2 p-2 rounded bg-gray-700 border border-gray-600 w-full"
                    />
                  )}
                </div>
                {/* Logs Block */}
                <div className="mt-2 p-2 bg-gray-900 rounded h-40 overflow-y-auto font-mono text-xs">
                  {displayedLogs.map((log, index) => (
                    <p key={index}>{formatLogMessage(log)}</p>
                  ))}
                </div>
                {/* Buttons */}
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => {
                      if (activeConversation?.states?.diarization) {
                        if (window.confirm("Warning: restarting diarization will overwrite existing data. Continue?")) {
                          setDiarizationLogs([]);
                          handleStartDiarization();
                        }
                      } else {
                        setDiarizationLogs([]);
                        handleStartDiarization();
                      }
                    }}
                    disabled={!hasAudio || isDiarizationProcessing}
                    className="w-full p-2 bg-blue-500 hover:bg-blue-600 rounded"
                  >
                    {diarizationButtonLabel}
                  </button>
                </div>
                {/* Show results only when fetch has been clicked */}
                {activeConversation?.states.diarization && showResults && (
                  <>
                    {/* Timeline and Speaker Selection Block */}
                    <div className="flex flex-col space-y-4 mt-4">
                      <SpeakerTimeline 
                        results={diarizationResults} 
                        totalDuration={totalDuration} 
                        assignedMapping={assignedSpeakers}
                        availableSpeakers={availableSpeakers || []}
                        audioSrc={serverMetadata ? `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/${activeConversation?.id}.mp3` : ''}
                        fixedSpeakerCount={speakerCount}  // <-- added fixedSpeakerCount prop
                      />
                      <div className="bg-gray-700 p-4 rounded">
                        <h4 className="text-xl font-bold mb-2">Speaker Selection</h4>
                        {Array.from({ length: speakerCount }, (_, i) => {
                          const label = `SPEAKER_${i < 10 ? `0${i}` : i}`;
                          const assignedSpeaker = assignedSpeakers[label]
                            ? availableSpeakers?.find(s => s.id === assignedSpeakers[label])
                            : null;
                            const computedSrc = `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversations/${activeConversation.id}_${activeConversation.name.replace(/\s/g, '')}/speakerAudioSegments/${getSpeakerAudioFilename(i, activeConversation.id)}`;
                          return (
                            <div key={label} className="flex items-center justify-between bg-gray-800 p-2 rounded mb-2">
                              <div className="flex items-center cursor-pointer" onClick={() => {
                                setCurrentDiarSpeaker(label);
                                setShowSpeakerSelectModal(true);
                              }}>
                                <SpeakerCard
                                  speaker={assignedSpeaker || { id: label, name: `Speaker ${i + 1}` }}
                                  showName={true}
                                  className="w-40"
                                />
                              </div>
                              <div className="flex-1 ml-4">
                                <audio controls className="w-full" src={computedSrc} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* New: Update Speakers button */}
                      <button
                        onClick={handleUpdateSpeakerAssignment}
                        className="mt-4 w-full p-2 bg-teal-500 hover:bg-teal-600 rounded"
                      >
                        Update Speaker Assignment
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-yellow-400">Audio is not available. Please upload an audio file first.</p>
            )}
          </div>
        )}

        {selectedStatus === 'transcription' && (
          <div>
            <h3 className="text-2xl font-bold mb-2">Transcription</h3>
            <div className="p-4 bg-gray-700 rounded mb-2">
              <p>
                <strong>Processing Device:</strong> {activeConversation?.transcriptionProcess?.device || 'N/A'}
              </p>
              <p>
                <strong>Started:</strong> {activeConversation?.transcriptionProcess 
                  ? formatReadableDateTime(activeConversation.transcriptionProcess.timeStarted)
                  : "N/A"}
              </p>
              <p>
                {isTranscriptionProcessing
                  ? `Elapsed Time: ${transcriptionElapsed.toFixed(3)} seconds`
                  : activeConversation?.transcriptionProcess?.timeCompleted
                    ? `Duration: ${secondsToString(activeConversation.transcriptionProcess.timeCompleted - activeConversation.transcriptionProcess.timeStarted)}`
                    : ''}
              </p>
            </div>
            <div className="mt-2 p-2 bg-gray-900 rounded h-40 overflow-y-auto font-mono text-xs">
              {transcriptionLogs.map((log, index) => (
                <p key={index}>{formatLogMessage(log)}</p>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {!isTranscriptionProcessing && (
                <>
                  <button
                    onClick={() => {
                      if (activeConversation?.transcriptionProcess?.timeCompleted) {
                        if (window.confirm("Warning: restarting transcription will overwrite existing data. Continue?")) {
                          setTranscriptionLogs([]);
                          handleStartTranscription();
                        }
                      } else {
                        setTranscriptionLogs([]);
                        handleStartTranscription();
                      }
                    }}
                    disabled={!activeConversation?.states?.audioAvailable}
                    className={`w-full p-2 rounded ${activeConversation?.transcriptionProcess?.timeCompleted ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {activeConversation?.transcriptionProcess?.timeCompleted ? 'Restart Transcription' : 'Start Transcription'}
                  </button>
                  {activeConversation?.transcriptionProcess?.timeCompleted && (
                    <button
                      onClick={handleShowTranscription}
                      className="w-full p-2 bg-purple-500 hover:bg-purple-600 rounded mt-2"
                    >
                      Show Transcription
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {selectedStatus === 'chat' && (
          <div>
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold mb-2">Chat</h3>
              {chatContent && (
                <button
                  onClick={handleCopyChat}
                  className="p-2 bg-indigo-500 hover:bg-indigo-600 rounded text-sm"
                >
                  Copy Chat
                </button>
              )}
            </div>
            {canCreateChat ? (
              <>
                <button
                  onClick={handleFetchChat}
                  className="mb-4 p-2 bg-green-600 hover:bg-green-700 rounded"
                >
                  Create Chat
                </button>
                {chatContent ? (
                  <Chat chatContent={chatContent} />
                ) : (
                  <p>No chat available yet.</p>
                )}
              </>
            ) : (
              <p>
                Chat is not available. Please ensure diarization, transcript and speaker assignment are complete.
              </p>
            )}
          </div>
        )}

        {selectedStatus === 'analysis' && (
          <div>
            <h3 className="text-2xl font-bold mb-2">Analysis</h3>
            {chatContent ? (
              <ChatAnalysis
                chatContent={createChatCompact(chatContent, availableSpeakers)}
                speakers={availableSpeakers}
                containerClassName="mt-4"
                summaryClassName=""
                keynotesContainerClassName=""
                speakerClassName=""
                bulletPointClassName=""
                errorClassName=""
              />
            ) : (
              <p>No chat content available for analysis. Please generate chat content first.</p>
            )}
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

      {/* Modal for speaker selection */}
      {showSpeakerSelectModal && availableSpeakers && (
        <ReactModal
          isOpen={showSpeakerSelectModal}
          onRequestClose={() => setShowSpeakerSelectModal(false)}
          ariaHideApp={false} // Prevent React-Modal warning
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
          overlayClassName="Overlay"
        >
          <div className="bg-gray-800 p-4 rounded text-white max-w-md w-full">
            <h4 className="text-xl font-bold mb-2">Select a Speaker</h4>
            <div className="grid grid-cols-3 gap-2">
              {availableSpeakers.map(s => (
                <div key={s.id} onClick={() => handleSpeakerSelect(s)} className="cursor-pointer">
                  <SpeakerCard speaker={s} showName={true} />
                </div>
              ))}
            </div>
            <button 
              onClick={() => setShowSpeakerSelectModal(false)}
              className="mt-4 p-2 bg-blue-500 hover:bg-blue-600 rounded"
            >
              Cancel
            </button>
          </div>
        </ReactModal>
      )}

      {/* Floating Transcription Modal */}
      {showTranscriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="relative bg-gray-800 text-white rounded-lg p-6 w-11/12 md:w-3/4 lg:w-3/4 max-h-[80vh]">
            {/* Top buttons (fixed) */}
            <div className="flex justify-between items-center mb-4">
              <button 
                onClick={() => setShowTranscriptionModal(false)}
                className="px-2 py-1 bg-red-600 rounded"
              >
                Close
              </button>
              <button 
                onClick={() => setTranscriptionViewMode(prev => prev === 'block' ? 'line' : 'block')}
                className="px-2 py-1 bg-blue-600 rounded"
              >
                {transcriptionViewMode === 'block' ? 'Line View' : 'Block View'}
              </button>
            </div>
            {/* Scrollable content */}
            <div className="overflow-y-auto max-h-[65vh] whitespace-pre-wrap">
              {transcriptionData 
                ? transcriptionViewMode === 'block'
                  ? getBlockTranscription(transcriptionData)
                  : getLineTranscription(transcriptionData)
                : "Loading transcription..."}
            </div>
          </div>
        </div>
      )}

      {/* Floating Diarization Modal */}
      {showDiarizationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="relative bg-gray-800 text-white rounded-lg p-6 w-11/12 md:w-3/4 lg:w-3/4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Diarization Details</h3>
              <button 
                onClick={() => setShowDiarizationModal(false)}
                className="px-2 py-1 bg-red-600 rounded"
              >
                Close
              </button>
            </div>
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
                    <td className="px-4 py-2">{secondsToString(result.duration, true)}</td>
                    <td className="px-4 py-2">{result.speaker}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationPipeline;
