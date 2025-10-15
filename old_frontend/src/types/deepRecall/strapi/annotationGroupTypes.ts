import { StrapiResponse } from "../../strapiTypes";
import { Annotation, AnnotationStrapi, deserializeAnnotation, serializeAnnotation } from "./annotationTypes";

export interface AnnotationGroupStrapi extends StrapiResponse {
  name: string;
  annotations?: {
    data?:          AnnotationStrapi[];
    connect?:       string[];
    disconnect?:    string[];
    set?:           string[];
  };
}

// Add updated frontend interface
export interface AnnotationGroup extends StrapiResponse {
  name: string;
  annotations?: Annotation[];
}

export function deserializeAnnotationGroup(response: AnnotationGroupStrapi): AnnotationGroup {
  const annotations = response.annotations?.data || [];
  return {
    ...response,
    annotations: annotations.map((annotation) => deserializeAnnotation(annotation)),
  };
}

export function serializeAnnotationGroup(group: AnnotationGroup): AnnotationGroupStrapi {
  const annotationIds = group.annotations?.map((annotation) => annotation.documentId) || [];
  return {
    ...group,
    annotations: {
      set: annotationIds,
    },
  } as AnnotationGroupStrapi;
}