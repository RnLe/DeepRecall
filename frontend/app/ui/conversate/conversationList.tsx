// conversationList.tsx

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import ConversationCard from './conversationCard';
// Removed ConversationPipeline import as it is not shown in the sidebar.
import SparkMD5 from 'spark-md5';
import { Conversation } from '../../types/diarizationTypes';
import { useActiveConversation } from '../../context/activeConversationContext';

const fetchConversations = async (): Promise<Conversation[]> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversations`);
  if (!res.ok) {
    throw new Error('Failed to fetch conversations');
  }
  const data = await res.json();
  console.log('Fetched conversations:', data);
  return data.conversations;
};

const ConversationList: React.FC = () => {
  const { activeConversation, setActiveConversation } = useActiveConversation();
  const { data: conversations, isLoading, isError, refetch } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
  });
  
  // Local state for conversation creation and active conversation.
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newConvName, setNewConvName] = useState("");
  const [newConvId, setNewConvId] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [initDevice, setInitDevice] = useState("");

  // Automatically compute conversation ID from the conversation name.
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
    formData.append("description", ""); // Adjust as needed.
    formData.append("speakers", "");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/initialize`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setInitDevice(data.device);
      setShowCreateForm(false);
      setInitialized(true);
      setActiveConversation(data.conversation);
      refetch();
    } catch (error) {
      console.error("Initialization failed", error);
    }
  };

  // When clicking on an existing conversation card.
  const handleConversationClick = (conv: Conversation) => {
    setActiveConversation(conv);
    setShowCreateForm(false);
    setNewConvName(conv.name);
    setNewConvId(conv.id);
    setInitialized(true);
  };

  return (
    <div className="p-4 bg-gray-900">
      <h2 className="text-xl font-bold mb-4 text-white">Conversations</h2>
      {isLoading && <div className="p-4 text-white">Loading conversations...</div>}
      {isError && <div className="p-4 text-red-500">Error loading conversations.</div>}
      <div className="flex flex-wrap">
        {conversations && conversations.length > 0 && conversations.map((conv) => (
          <div key={conv.id} className="w-full p-2">
            <ConversationCard 
              conversation={conv} 
              active={activeConversation?.id === conv.id} 
              customClass="h-full" 
              onClick={() => handleConversationClick(conv)}
            />
          </div>
        ))}
        <div className="p-2 w-full">
          <div
            onClick={() => { 
              setShowCreateForm(true); 
              setActiveConversation(null); 
              setInitialized(false); 
              setNewConvName("");
            }}
            className="border-2 border-dashed border-gray-600 rounded p-4 cursor-pointer hover:border-blue-400 flex items-center justify-center h-full"
          >
            <span className="text-1xl text-gray-400">+ Create New Conversation</span>
          </div>
        </div>
      </div>
      {/* New Conversation Form */}
      {showCreateForm && (
        <div 
          onClick={() => setShowCreateForm(false)}
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-800 p-4 rounded text-white space-y-4 w-96"
          >
            <h3 className="text-lg font-bold">New Conversation</h3>
            <div className="space-y-2">
              <input 
                type="text" 
                placeholder="Conversation Name" 
                value={newConvName}
                onChange={(e) => setNewConvName(e.target.value)}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded"
              />
              <p className="mt-2 text-gray-400 text-sm">
                Conversation ID: {newConvId}
              </p>
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
                  This will create the conversation record.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-300">
                  Conversation initialized. Device: {initDevice}.
                </p>
              </div>
            )}
            <button 
              onClick={() => setShowCreateForm(false)}
              className="mt-2 bg-gray-600 px-4 py-2 rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationList;
