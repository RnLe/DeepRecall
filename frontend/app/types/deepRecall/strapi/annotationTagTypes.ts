import { StrapiResponse } from "../../strapiTypes";
import { Annotation, AnnotationStrapi, deserializeAnnotation, serializeAnnotation } from "./annotationTypes";

export interface AnnotationTagStrapi extends StrapiResponse {
  name: string;
  annotations?: {
    data?:          AnnotationStrapi[];
    connect?:       string[];
    disconnect?:    string[];
    set?:           string[];
  };
}

// Frontend interface for AnnotationTag
export interface AnnotationTag extends StrapiResponse {
    name: string;
    annotations?: Annotation[];
}

export function deserializeAnnotationTag(response: AnnotationTagStrapi): AnnotationTag {
    // Get each annotation strapi object from the response
    // Note: This field is only populated when explicitly requested (via the API)
    const annotations = response.annotations?.data || [];
    return {
        ...response,
        annotations: annotations.map((annotation) => ({
            ...deserializeAnnotation(annotation), // Deserialize each annotation
        })),
    };
}

export function serializeAnnotationTag(tag: AnnotationTag): AnnotationTagStrapi {
    // Get a list of documentIds from the annotations
    const annotationIds = tag.annotations?.map((annotation) => annotation.documentId) || [];

    return {
        ...tag,
        annotations: {
            set: annotationIds,
        },
    } as AnnotationTagStrapi;
}