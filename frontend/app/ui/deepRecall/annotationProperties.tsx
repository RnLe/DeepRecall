// annotationProperties.tsx

import React from 'react';
import { Annotation } from '@/app/helpers/annotationTypes';

interface AnnotationPropertiesProps {
  annotation: Annotation | null;
  updateAnnotation: (updated: Annotation) => void;
}

const AnnotationProperties: React.FC<AnnotationPropertiesProps> = ({ annotation, updateAnnotation }) => {
  if (!annotation) {
    return <div className="p-4">No annotation selected.</div>;
  }
  
  // Handler for form field changes.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    updateAnnotation({ ...annotation, [name]: value });
  };

  return (
    <div className="p-4 border-l border-gray-700">
      <h3 className="text-lg font-semibold mb-2">Annotation Properties</h3>
      <div className="mb-2">
        <label className="block mb-1">Title:</label>
        <input 
          type="text" 
          name="title" 
          value={annotation.title || ''} 
          onChange={handleChange} 
          className="w-full p-1 rounded bg-gray-800 text-white border border-gray-600"
        />
      </div>
      <div className="mb-2">
        <label className="block mb-1">Description:</label>
        <textarea 
          name="description" 
          value={annotation.description || ''} 
          onChange={handleChange} 
          className="w-full p-1 rounded bg-gray-800 text-white border border-gray-600"
        />
      </div>
      {/* Add additional fields as required */}
    </div>
  );
};

export default AnnotationProperties;
