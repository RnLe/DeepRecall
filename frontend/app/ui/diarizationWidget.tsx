// diarizationWidget.tsx
import React, { useEffect } from 'react';
import ConversationPipeline from './conversationPipeline';
import { useActiveConversation } from '../context/activeConversationContext';
import { HardwareBanner } from './hardwareBanner';

const DiarizationWidget: React.FC = () => {
  const { activeConversation, hardwareInfo, setHardwareInfo, setActiveConversation } = useActiveConversation();

  useEffect(() => {
    if (!hardwareInfo) {
      fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/hardware`)
        .then((res) => res.json())
        .then((data) => setHardwareInfo(data))
        .catch((err) => console.error('Hardware check failed', err));
    }
  }, [hardwareInfo, setHardwareInfo]);

  if (!hardwareInfo) {
    return (
      <div className="p-4 flex-1 bg-gray-900">
        <h2 className="text-xl font-bold mb-4 text-white">Loading Hardware Information...</h2>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!activeConversation) return;
    if (!window.confirm('Are you sure you want to delete this conversation? All data for this conversation will be deleted as well.')) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/${activeConversation.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        throw new Error('Failed to delete conversation');
      }
      alert('Conversation deleted successfully');
      window.location.reload(); // Alternatively, clear the active conversation in parent state
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleCancel = () => {
    setActiveConversation(null); // Clear the active conversation
  };

  return (
    <div className="p-4 flex-1 bg-gray-900">
      <HardwareBanner />
      <div className="mt-4">
        {activeConversation ? (
          <div>
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold mb-4 text-white">{activeConversation.name}</h2>
              <div className="flex space-x-2">
                <button 
                  onClick={handleDelete} 
                  className="text-white bg-red-500 px-3 py-1 rounded hover:bg-red-600"
                >
                  Delete Conversation
                </button>
                <button 
                  onClick={handleCancel} 
                  className="text-white bg-gray-500 px-3 py-1 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="mt-4 p-4 bg-gray-800 rounded text-white space-y-4">
              <ConversationPipeline/>
            </div>
          </div>
        ) : (
          <h2 className="text-xl font-bold mb-4 text-white">No Conversation Selected</h2>
        )}
      </div>
    </div>
  );
};

export default DiarizationWidget;
