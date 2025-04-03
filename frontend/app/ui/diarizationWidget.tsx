import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import ConversationCard from './conversationCard';
import ConversationPipeline from './conversationPipeline';
import SparkMD5 from 'spark-md5';

interface Conversation {
  id: string;
  name: string;
  description: string;
  speakers: string[]; // Array of speaker IDs.
  length: string;
  states?: {
    diarization: boolean;
    transcription: boolean;
    speakerAssignment: boolean;
    report: boolean;
    stats: boolean;
  };
}

const fetchConversations = async (): Promise<Conversation[]> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversations`);
  if (!res.ok) {
    throw new Error('Failed to fetch conversations');
  }
  const data = await res.json();
  console.log('Fetched conversations:', data);
  return data.conversations;
};

const DiarizationWidget: React.FC = () => {
  const { data: conversations, isLoading, isError, refetch } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: fetchConversations
  });
  
  // State for new conversation form.
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newConvName, setNewConvName] = useState("");
  const [newConvId, setNewConvId] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [initDevice, setInitDevice] = useState("");

  // State for active (existing) conversation.
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  // Automatically compute conversation id from the name.
  useEffect(() => {
    if (newConvName) {
      const hash = SparkMD5.hash(newConvName);
      setNewConvId(hash);
    } else {
      setNewConvId("");
    }
  }, [newConvName]);

  // Handler to initialize a new conversation.
  const handleInitialize = async () => {
    if (!newConvName) return;
    const formData = new FormData();
    formData.append("name", newConvName);
    formData.append("description", ""); // Expand as needed.
    formData.append("speakers", "");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/initialize`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setInitDevice(data.device);
      setInitialized(true);
      // Also set the newly created conversation as active.
      setActiveConversation(data.conversation);
      refetch();
    } catch (error) {
      console.error("Initialization failed", error);
    }
  };

  // Handler for clicking an existing conversation card.
  const handleConversationClick = (conv: Conversation) => {
    setActiveConversation(conv);
    setShowCreateForm(false);
    // Optionally update new conversation fields for display.
    setNewConvName(conv.name);
    setNewConvId(conv.id);
    setInitialized(true);
  };

  return (
    <div className="p-4 flex-1 bg-gray-900">
      <h2 className="text-xl font-bold mb-4 text-white">Conversations</h2>
      {isLoading && <div className="p-4 text-white">Loading conversations...</div>}
      {isError && <div className="p-4 text-red-500">Error loading conversations.</div>}
      {conversations && conversations.length > 0 ? (
        <div className="space-y-4">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => handleConversationClick(conv)}
              className="cursor-pointer"
            >
              <ConversationCard conversation={conv} active={activeConversation?.id === conv.id} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-white">No conversations found.</div>
      )}
      {/* Button to create a new conversation */}
      <div
        className="mt-4 flex items-center justify-center border-2 border-dashed border-gray-600 rounded p-4 cursor-pointer hover:border-blue-400"
        onClick={() => { 
          setShowCreateForm(true); 
          setActiveConversation(null); 
          setInitialized(false); 
          setNewConvName(""); 
        }}
      >
        <span className="text-3xl text-gray-400">+ Create New Conversation</span>
      </div>
      {/* New Conversation Form */}
      {showCreateForm && (
        <div className="mt-4 p-4 bg-gray-800 rounded text-white space-y-4">
          <h3 className="text-lg font-bold">New Conversation Pipeline</h3>
          <div className="space-y-2">
            <input 
              type="text" 
              placeholder="Conversation Name" 
              value={newConvName}
              onChange={(e) => setNewConvName(e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
            />
            {newConvName && (
              <input 
                type="text"
                value={newConvId}
                readOnly
                className="w-full p-2 bg-gray-600 border border-gray-500 rounded text-gray-200"
              />
            )}
          </div>
          {!initialized ? (
            <div className="space-y-2">
              <button 
                onClick={handleInitialize}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded"
              >
                Initialize Conversation
              </button>
              <p className="text-gray-400 text-sm">
                This will create the conversation record and check device availability.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-gray-300">
                Conversation initialized. Device: {initDevice}.
              </p>
              {/* Embed the pipeline for the newly created conversation */}
              <ConversationPipeline convId={newConvId} />
            </div>
          )}
          <button 
            onClick={() => setShowCreateForm(false)}
            className="mt-2 bg-gray-600 px-4 py-2 rounded hover:bg-gray-500"
          >
            Cancel
          </button>
        </div>
      )}
      {/* If an existing conversation is active, show its pipeline */}
      {activeConversation && !showCreateForm && (
        <div className="mt-4 p-4 bg-gray-800 rounded text-white space-y-4">
          <h3 className="text-lg font-bold">Continue Conversation Pipeline</h3>
          <p className="text-gray-300">Conversation: {activeConversation.name}</p>
          <ConversationPipeline convId={activeConversation.id} states={activeConversation.states} />
          <button 
            onClick={() => setActiveConversation(null)}
            className="mt-2 bg-gray-600 px-4 py-2 rounded hover:bg-gray-500"
          >
            Close Conversation
          </button>
        </div>
      )}
    </div>
  );
};

export default DiarizationWidget;
