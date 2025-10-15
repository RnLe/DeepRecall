'use client';

import React, { useState } from 'react';
import LiteratureList from '@/src/ui/deepRecall/literatureList';
import CollectionsManager from '@/src/ui/deepRecall/collectionsManager';

export default function LiteraturePage() {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [isCollectionEditMode, setIsCollectionEditMode] = useState<string | null>(null);

  // Handle when user wants to add literature to a collection
  const handleCollectionEditRequest = (collectionId: string) => {
    // Switch to "All Literature" view and enter multi-select mode for this collection
    setSelectedCollection(null); // Show all literature, not just collection literature
    setIsCollectionEditMode(collectionId); // Trigger multi-select mode for this collection
  };

  const handleCollectionSelect = (collectionId: string | null) => {
    setSelectedCollection(collectionId);
    setIsCollectionEditMode(null); // Clear edit mode when switching collections normally
  };

  return (
    <main className="flex h-full">
      <div className="w-1/4 border-r flex flex-col">
        <div className="flex-1 overflow-hidden">
          <CollectionsManager 
            className="h-full" 
            onCollectionSelect={handleCollectionSelect}
            selectedCollection={selectedCollection}
            onRequestEditMode={handleCollectionEditRequest}
          />
        </div>
      </div>
      <div className="w-3/4 flex flex-col">
        <div className="flex-1 overflow-hidden">
          <LiteratureList 
            selectedCollection={selectedCollection}
            collectionEditMode={isCollectionEditMode}
            onCollectionEditComplete={() => setIsCollectionEditMode(null)}
          />
        </div>
      </div>
    </main>
  );
}
