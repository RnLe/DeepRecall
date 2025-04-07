// diarizationWidget.tsx
import React from 'react';
import ConversationPipeline from './conversationPipeline';
import { useActiveConversation } from '../context/activeConversationContext';

const DiarizationWidget: React.FC = () => {
  const { activeConversation } = useActiveConversation();

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

  if (!activeConversation) {
    return (
      <div className="p-4 flex-1 bg-gray-900">
        <h2 className="text-xl font-bold mb-4 text-white">No Conversation Selected</h2>
        {/* Optionally, you could add instructions here */}
      </div>
    );
  }

  return (
    <div className="p-4 flex-1 bg-gray-900">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold mb-4 text-white">{activeConversation.name}</h2>
        <button 
          onClick={handleDelete} 
          className="text-white bg-red-500 px-3 py-1 rounded hover:bg-red-600"
        >
          Delete Conversation
        </button>
      </div>
      <div className="mt-4 p-4 bg-gray-800 rounded text-white space-y-4">
        <ConversationPipeline/>
      </div>
    </div>
  );
};

export default DiarizationWidget;
