// literatureList.tsx
import React from 'react';
import { useLiterature } from '../../customHooks/useLiterature';
import LiteratureCardM from './literatureCardM';
import { LITERATURE_TYPES, LiteratureType, mapLiteratureItems, LITERATURE_TYPE_STRING_PLURAL } from '../../helpers/literatureTypes';

interface LiteratureListProps {
  className?: string;
}

export default function LiteratureList({ className }: LiteratureListProps) {
  const { data, isLoading, error } = useLiterature();

  if (isLoading) {
    return <div className={`p-4 ${className}`}>Loading literature...</div>;
  }
  if (error) {
    return (
      <div className={`p-4 text-red-600 ${className}`}>
        Error loading literature: {(error as Error).message}
      </div>
    );
  }

  // console.log('Literature data:', data);

  return (
    <div className={`p-4 bg-gray-800 text-white overflow-auto ${className}`}>
      <h1 className="text-xl font-bold mb-4">Literature List</h1>
      {LITERATURE_TYPES.map((type: LiteratureType) => {
        // Map the raw data into LiteratureItem objects for the current type
        const items = data ? mapLiteratureItems(data, type) : [];
        return (
          <section key={type} className="mb-4">
            <h3 className="font-semibold text-lg">
              {LITERATURE_TYPE_STRING_PLURAL[type]} ({items.length})
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {items.length > 0 ? (
                items.map((item) => (
                  <LiteratureCardM
                    key={item.documentId}
                    documentId={item.documentId}
                    title={item.title ?? `Untitled ${type}`}
                    type={type}
                    metadata={item.metadata}
                  />
                ))
              ) : (
                <p className="text-gray-400">No {LITERATURE_TYPE_STRING_PLURAL[type]} available.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
