// conversationPipeline.tsx

import React, { useState, useEffect, useRef } from 'react';
import { secondsToString } from '../helpers/timesToString';
import { Conversation } from '../helpers/diarizationTypes';
import { useActiveConversation } from '../context/activeConversationContext';
import { useQuery } from '@tanstack/react-query';

import { fetchConversationDetails } from '../api/conversationApi';
import { StatusBar, StatusType } from './statusBar';
import { HardwareBanner } from './hardwareBanner';
import { TokenModal } from './tokenModal';
import { formatLogMessage, formatReadableDateTime } from '../helpers/logHelpers';
import { DiarizationResult, parseRTTM } from '../helpers/diarizationHelpers';
import { SpeakerTimeline } from './speakerTimeline';
import SpeakerCard from './speakerCard';
import { Speaker } from '../helpers/diarizationTypes';
import ReactModal from 'react-modal'; // added for modal support


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
    if (activeConversation?.id && activeConversation.states?.speakerAudioSegments) {
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
    if (conversationDetails && conversationDetails.speakers && diarizationResults.length) {
      const distinct = Array.from(new Set(diarizationResults.map(d => d.speaker)));
      const mapping: { [key: string]: string } = {};
      distinct.forEach((ds, idx) => {
        mapping[ds] = conversationDetails.speakers[idx] || "";
      });
      setAssignedSpeakers(mapping);
    }
  }, [conversationDetails, diarizationResults]);
  
  // Handler when a speaker is selected from modal
  const handleSpeakerSelect = (selected: Speaker) => {
    // Prevent assigning the same speaker twice to different diarization labels
    const isAlreadyAssigned = Object.entries(assignedSpeakers).some(
      ([diar, speakerId]) => speakerId === selected.id && diar !== currentDiarSpeaker
    );
    if (isAlreadyAssigned) {
      alert("This speaker is already assigned. Please choose a different speaker.");
      return;
    }
    const newMapping = { ...assignedSpeakers, [currentDiarSpeaker]: selected.id };
    setAssignedSpeakers(newMapping);
    setShowSpeakerSelectModal(false);
    
    // Immediately update the server with new assignment (comma separated ordered by distinct diar speakers)
    if (activeConversation) {
      const distinct = Array.from(new Set(diarizationResults.map(d => d.speaker)));
      const speakersList = distinct.map(ds => newMapping[ds] || "").join(",");
      const formData = new FormData();
      formData.append('speakers', speakersList);
      formData.append('conv_id', activeConversation.id);
      fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/${activeConversation.id}/update-speakers`, {
        method: 'PUT',
        body: formData,
      })
      .then(res => res.json())
      .then(data => console.log("Updated assignment:", data))
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
      // START OF CHANGES: Use a logBuffer and flush every 500ms.
      let logBuffer: string[] = [];
      let lastUpdate = Date.now();
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value);
        const messages = chunk.split("\n").filter(line => line.trim() !== "");
        logBuffer.push(...messages.map(formatLogMessage));
        if (Date.now() - lastUpdate > 500) {
          setDiarizationLogs(prev => [...prev, ...logBuffer]);
          logBuffer = [];
          lastUpdate = Date.now();
        }
      }
      if (logBuffer.length > 0) {
        setDiarizationLogs(prev => [...prev, ...logBuffer]);
      }
      // END OF CHANGES
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
      setShowResults(true); // Mark that results have been fetched.
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
    activeConversation?.states?.diarization
      ? (isDiarizationProcessing ? 'Diarization in Progress...' : 'Restart Diarization')
      : 'Start Diarization';

  // Compute a total duration for the timeline: use the maximum of the audio duration and the maximum of (startTime+duration) from results.
  const computedDuration = diarizationResults.reduce((max, r) => Math.max(max, r.startTime + r.duration), 0);
  const totalDuration = audioDuration > computedDuration ? audioDuration : computedDuration;

  const [showResults, setShowResults] = useState(false);

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
                  {activeConversation?.states.diarization && (
                    <button
                      onClick={handleFetchResults}
                      disabled={!activeConversation}
                      className="w-full p-2 bg-purple-500 hover:bg-purple-600 rounded"
                    >
                      Fetch Results
                    </button>
                  )}
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
                      />
                      <div className="bg-gray-700 p-4 rounded">
                        <h4 className="text-xl font-bold mb-2">Speaker Selection</h4>
                        {(() => {
                          const distinctDiarSpeakers = Array.from(new Set(diarizationResults.map(r => r.speaker)));
                          return distinctDiarSpeakers.map((speakerLabel, index) => {
                            const audioKey = Object.keys(speakerAudios)[index];
                            const audioData = speakerAudios[audioKey];
                            const computedSrc = audioData ? `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/${audioData.audio_file}` : "";
                            return (
                              <div key={`${speakerLabel}-${index}`} className="flex items-center justify-between bg-gray-800 p-2 rounded mb-2">
                                <div className="flex items-center cursor-pointer" onClick={() => {
                                  setCurrentDiarSpeaker(speakerLabel);
                                  setShowSpeakerSelectModal(true);
                                }}>
                                  <SpeakerCard
                                    speaker={{ id: speakerLabel, name: `Speaker ${index + 1}` }}
                                    showName={true}
                                    className="w-40"
                                  />
                                </div>
                                <div className="flex-1 ml-4">
                                  {audioData ? (
                                    <audio controls className="w-full" src={computedSrc} />
                                  ) : (
                                    <span className="text-sm text-gray-400 block">No audio available</span>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                    {/* Details Table */}
                    <div className="mt-2">
                      {showTable && (
                        <div className="mt-2 max-h-60 overflow-auto border border-gray-700 rounded">
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
                      )}
                      <button
                        onClick={() => setShowTable(prev => !prev)}
                        className="mt-4 w-full p-2 bg-indigo-500 hover:bg-indigo-600 rounded"
                      >
                        {showTable ? 'Hide Details Table' : 'Show Details Table'}
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
            {activeConversation?.states.transcript ? (
              <p>Transcription already completed.</p>
            ) : (
              <p>Transcription process placeholder.</p>
            )}
          </div>
        )}

        {selectedStatus === 'speakerAssignment' && (
          <div>
            <h3 className="text-2xl font-bold mb-2">Speaker Assignment</h3>
            {activeConversation?.states.speakerAudioSegments ? (
              <div className="bg-gray-700 p-4 rounded">
                <h4 className="text-xl font-bold mb-2">Speaker Selection</h4>
                {(() => {
                  // Compute distinct diarization speakers
                  const distinctDiarSpeakers = Array.from(new Set(diarizationResults.map(r => r.speaker)));
                  return distinctDiarSpeakers.map((speakerLabel, index) => {
                    const audioKey = Object.keys(speakerAudios)[index]; // Fetch audio by order
                    const audioData = speakerAudios[audioKey];
                    const computedSrc = audioData ? `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/${audioData.audio_file}` : "";
                    return (
                      <div key={`${speakerLabel}-${index}`} className="flex items-center justify-between bg-gray-800 p-2 rounded mb-2">
                        <div
                          className="flex items-center cursor-pointer"
                          onClick={() => {
                            setCurrentDiarSpeaker(speakerLabel);
                            setShowSpeakerSelectModal(true);
                          }}
                        >
                          <SpeakerCard
                            speaker={{ id: speakerLabel, name: `Speaker ${index + 1}` }}
                            showName={true}
                            className="w-40"
                          />
                        </div>
                        <div className="flex-1 ml-4">
                          {audioData ? (
                            <audio
                              controls
                              className="w-full"
                              // Using absolute URL for audio source
                              src={computedSrc}
                            />
                          ) : (
                            <span className="text-sm text-gray-400 block">No audio available</span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <p className="text-yellow-400">Speaker audio segments are not available yet.</p>
            )}
          </div>
        )}

        {selectedStatus === 'chat' && (
          <div>
            <h3 className="text-2xl font-bold mb-2">Chat</h3>
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
    </div>
  );
};

export default ConversationPipeline;
