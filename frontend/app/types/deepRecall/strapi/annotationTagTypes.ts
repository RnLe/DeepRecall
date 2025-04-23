import { StrapiResponse } from "../../strapiTypes";
import { AnnotationStrapi } from "./annotationTypes";

export interface AnnotationTagStrapi extends StrapiResponse {
  name: string;
  annotations?: {
    data?:      AnnotationStrapi[];
    connect?:   string[];
    disconnect?: string[];
    set?:       string[];
  };
}

export interface AnnotationTag extends AnnotationTagStrapi {
}

// The serialization and deserialization functions are not needed for this type (yet).
// They are introduced anyway for consistency with other types.

export function deserializeAnnotationTag(tag: AnnotationTagStrapi): AnnotationTag {
  return {
    ...tag,
  };
}

export function serializeAnnotationTag(tag: AnnotationTag): AnnotationTagStrapi {
  return {
    ...tag,
  } as AnnotationTagStrapi;
}