// conversationApi.ts

import { Conversation } from '../types/conversate/diarizationTypes';

export const fetchConversationDetails = async (id: string): Promise<Conversation> => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/conversation/${id}`);
  if (!res.ok) {
    throw new Error('Failed to fetch conversation details');
  }
  return res.json();
};
