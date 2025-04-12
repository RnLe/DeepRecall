// annotationOverlay.tsx

import React from 'react';
import { Annotation } from '@/app/helpers/annotationTypes';

interface AnnotationOverlayProps {
  annotations: Annotation[];
  pageWidth: number;
  pageHeight: number;
  onSelectAnnotation: (annotation: Annotation) => void;
}

const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({ annotations, pageWidth, pageHeight, onSelectAnnotation }) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: pageWidth,
        height: pageHeight,
        pointerEvents: 'none'
      }}
    >
      {annotations.map(ann => {
        const style = {
          left: ann.x * pageWidth,
          top: ann.y * pageHeight,
          width: ann.width * pageWidth,
          height: ann.height * pageHeight,
          position: 'absolute',
          border: ann.type === 'rectangle' ? '2px solid red' : 'none',
          backgroundColor: ann.type === 'text' ? 'rgba(255, 255, 0, 0.3)' : 'transparent',
          pointerEvents: 'auto'
        };
        return (
          <div
            key={ann.id}
            style={style as React.CSSProperties}
            onClick={() => onSelectAnnotation(ann)}
          >
            {/* Optionally, add a tooltip or label */}
          </div>
        );
      })}
    </div>
  );
};

export default AnnotationOverlay;
