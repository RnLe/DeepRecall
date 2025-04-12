// annotationToolbar.tsx

import React from 'react';

export type AnnotationMode = 'none' | 'text' | 'rectangle';

interface AnnotationToolbarProps {
  mode: AnnotationMode;
  setMode: (mode: AnnotationMode) => void;
}

const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({ mode, setMode }) => {
  return (
    <div className="p-4 border-r border-gray-700">
      <h3 className="text-lg font-semibold mb-2">Annotation Tools</h3>
      <div className="flex flex-col space-y-2">
        <button
          className={`p-2 rounded ${mode === 'text' ? 'bg-blue-500' : 'bg-gray-600'}`}
          onClick={() => setMode('text')}
        >
          Text Annotation
        </button>
        <button
          className={`p-2 rounded ${mode === 'rectangle' ? 'bg-blue-500' : 'bg-gray-600'}`}
          onClick={() => setMode('rectangle')}
        >
          Rectangle Annotation
        </button>
        <button
          className="p-2 rounded bg-gray-600"
          onClick={() => setMode('none')}
        >
          Cancel Annotation
        </button>
      </div>
    </div>
  );
};

export default AnnotationToolbar;
