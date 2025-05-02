// PlannerMainContainer.tsx

"use client";

import React, { useState, useCallback } from 'react';
import { PlannerLeftSidebar } from './PlannerLeftSidebar';
import PlannerCanvasView from './PlannerCanvasView';
import PlannerRightSidebar from './PlannerRightSidebar';

export type CardId = string;

export const PlannerMainContainer: React.FC = () => {
  const [selectedCard, setSelectedCard] = useState<CardId | null>(null);
  const [cardToCenter, setCardToCenter] = useState<CardId | null>(null);
  // Added collapse states for left and right sidebars
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const handleSelectCard = useCallback((cardId: CardId) => {
    setSelectedCard(cardId);
  }, []);

  const handleDoubleClickCard = useCallback((cardId: CardId) => {
    setCardToCenter(cardId);
  }, []);

  const handleCenterGlobal = useCallback(() => {
    setCardToCenter('ALL');
  }, []);

  return (
    <div className="flex h-screen w-full bg-gray-900 text-white">
      <PlannerCanvasView
        selectedCard={selectedCard}
        onSelectCard={handleSelectCard}
        cardToCenter={cardToCenter}
        clearCardToCenter={() => setCardToCenter(null)}
      />
      <PlannerRightSidebar
        collapsed={rightCollapsed}
        toggleCollapse={() => {
          console.log('Main: toggling right sidebar', !rightCollapsed);
          setRightCollapsed((v) => !v);
        }}
        canvasState={null}
        setCanvasState={() => {}}
      />
    </div>
  );
};

export default PlannerMainContainer;