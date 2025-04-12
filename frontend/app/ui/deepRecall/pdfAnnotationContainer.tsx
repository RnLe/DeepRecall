// pdfAnnotationContainer.tsx

import React, { useState } from 'react';
import AnnotationToolbar, { AnnotationMode } from './annotationToolbar';
import PdfViewerWithAnnotations from './pdfViewerWithAnnotations';
import AnnotationProperties from './annotationProperties';
import { Annotation } from '../../helpers/annotationTypes';
import { LiteratureItem } from '../../helpers/literatureTypes';

interface PdfAnnotationContainerProps {
  activeLiterature: LiteratureItem;
}

const PdfAnnotationContainer: React.FC<PdfAnnotationContainerProps> = ({ activeLiterature }) => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>('none');
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);

  // Add a new annotation.
  const addAnnotation = (annotation: Annotation) => {
    setAnnotations(prev => [...prev, annotation]);
  };

  // Update an existing annotation.
  const updateAnnotation = (updated: Annotation) => {
    setAnnotations(prev => prev.map(ann => ann.id === updated.id ? updated : ann));
  };

  // Callback when an annotation is selected (either from viewer or properties).
  const handleSelectAnnotation = (annotation: Annotation) => {
    setSelectedAnnotation(annotation);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top controls (page navigation, zoom, etc.) can be added here */}
      <div className="flex flex-1">
        <div className="w-1/5">
          <AnnotationToolbar mode={annotationMode} setMode={setAnnotationMode} />
        </div>
        <div className="flex-1 border mx-2 relative">
          <PdfViewerWithAnnotations 
            activeLiterature={activeLiterature}
            annotationMode={annotationMode}
            annotations={annotations}
            onCreateAnnotation={addAnnotation}
            onSelectAnnotation={handleSelectAnnotation}
          />
        </div>
        <div className="w-1/5">
          <AnnotationProperties annotation={selectedAnnotation} updateAnnotation={updateAnnotation} />
        </div>
      </div>
    </div>
  );
};

export default PdfAnnotationContainer;
