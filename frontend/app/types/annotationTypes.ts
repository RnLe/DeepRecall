// annotationTypes.ts

// Base interface for shared properties.
export interface AnnotationStrapi {
    // The type of annotation
    type: string;
    // The metadata for the annotation in JSON format (basically everything else)
    metadata: string;
    
}

export interface AnnotationBase extends AnnotationStrapi {
  // The page number of the PDF where the annotation appears.
  page: number;
  // The literature document ID to which the annotation belongs.
  literatureId: number;
  // The pdf document ID to which the annotation belongs.
  pdfId: number;
  // Normalized position and size relative to the page dimensions (values between 0 and 1).
  // This normalization helps maintain correctness regardless of zoom level or page size.
  x: number; // relative left (0 to 1)
  y: number; // relative top (0 to 1)
  width: number;  // relative width
  height: number; // relative height
  // Common metadata for annotations.
  title?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Specific annotation type for text highlights.
export interface TextAnnotation extends AnnotationBase {
  type: 'text';
  // The highlighted text content.
  highlightedText: string;
}

// Specific annotation type for rectangle regions.
// The `annotationKind` field lets you assign semantic types later (e.g., Equation, Plot, etc.)
export interface RectangleAnnotation extends AnnotationBase {
  type: 'rectangle';
  annotationKind: 'Equation' | 'Plot' | 'Illustration' | 'Theorem' | 'Statement';
}

// If you plan to extend with more annotation types, create additional interfaces.
// Then you can create a union type of all annotations:
export type Annotation = TextAnnotation | RectangleAnnotation;
  