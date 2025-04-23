// literatureList.tsx

import React from 'react';
import { useLiterature, useLiteratureTypes } from '../../customHooks/useLiterature';
import LiteratureCardM from './literatureCardM';
import { LiteratureType } from '../../types/deepRecall/strapi/literatureTypes';
import { groupLiteraturesByType } from '@/app/helpers/groupLiterature';

interface LiteratureListProps {
  className?: string;
}

// Utility function to capitalize the first letter of a string
const capitalizeFirstLetter = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export default function LiteratureList({ className }: LiteratureListProps) {
  const { data: literatures, isLoading, error } = useLiterature();
  const { data: literatureTypes, isLoading: isTypesLoading, error: typesError } = useLiteratureTypes();

  if (isLoading || isTypesLoading) {
    return <div className={`p-4 ${className}`}>Loading literature and types...</div>;
  }
  if (error || typesError) {
    return (
      <div className={`p-4 text-red-600 ${className}`}>
        Error: {(error as Error)?.message || (typesError as Error)?.message}
      </div>
    );
  }

  // Group literature items by type for easier lookup.
  const literatureByType = groupLiteraturesByType(literatures);

  return (
    <div className={`p-4 bg-gray-800 text-white overflow-auto ${className}`}>
      <h1 className="text-xl font-bold mb-4">Literature List</h1>
      {literatureTypes.map((type: LiteratureType) => {
        // Get literature items that match the literature type name
        const items = literatureByType[type.name] || [];
        return (
          <section key={type.documentId || type.name} className="mb-4">
            <h3 className="font-semibold text-lg">
              {capitalizeFirstLetter(type.name)} ({items.length})
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {items.length > 0 ? (
                items.map((item) => (
                  <LiteratureCardM key={item.documentId} literature={item} />
                ))
              ) : (
                <p className="text-gray-400">No {type.name} available.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
