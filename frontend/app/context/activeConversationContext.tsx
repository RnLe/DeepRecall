// activeConversationContext.tsx
import React, { createContext, useContext, useState } from 'react';
import { Conversation } from '../types/conversate/diarizationTypes';
import { hardwareResponse } from '../types/conversate/diarizationTypes';

// Update the interface to accept either a Conversation or a nested object
interface ActiveConversationContextType {
  activeConversation: Conversation | null;
  setActiveConversation: (conv: Conversation | { conversation: Conversation } | null) => void;
  hardwareInfo: hardwareResponse | null; // New state for hardware info
  setHardwareInfo: (info: hardwareResponse | null) => void; // Setter for hardware info
}

const ActiveConversationContext = createContext<ActiveConversationContextType | undefined>(undefined);

export const ActiveConversationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeConversation, setActiveConversationState] = useState<Conversation | null>(null);
  const [hardwareInfo, setHardwareInfo] = useState<hardwareResponse | null>(null); // New state for hardware info

  // A helper type guard that checks if the provided object is nested.
  const isNestedConversation = (conv: any): conv is { conversation: Conversation } =>
    conv && typeof conv === 'object' && 'conversation' in conv;

  const setActiveConversation = (conv: Conversation | { conversation: Conversation } | null) => {
    if (conv && isNestedConversation(conv)) {
      // Unwrap the conversation object
      setActiveConversationState(conv.conversation);
    } else {
      setActiveConversationState(conv as Conversation | null);
    }
  };

  return (
    <ActiveConversationContext.Provider value={{ activeConversation, setActiveConversation, hardwareInfo, setHardwareInfo }}>
      {children}
    </ActiveConversationContext.Provider>
  );
};

export const useActiveConversation = () => {
  const context = useContext(ActiveConversationContext);
  if (!context) {
    throw new Error("useActiveConversation must be used within an ActiveConversationProvider");
  }
  return context;
};
