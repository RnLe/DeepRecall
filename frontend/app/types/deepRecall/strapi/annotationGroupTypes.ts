import { StrapiResponse } from "../../strapiTypes";
import { AnnotationStrapi } from "./annotationTypes";

export interface AnnotationGroupStrapi extends StrapiResponse {
  name: string;
  annotations?: {
    data?:      AnnotationStrapi[];
    connect?:   string[];
    disconnect?: string[];
    set?:       string[];
  };
}

export interface AnnotationGroup extends AnnotationGroupStrapi {
}

// The serialization and deserialization functions are not needed for this type (yet).
// They are introduced anyway for consistency with other types.

export function deserializeAnnotationGroup(group: AnnotationGroupStrapi): AnnotationGroup {
    return {
        ...group,
    };
}

export function serializeAnnotationGroup(group: AnnotationGroup): AnnotationGroupStrapi {
    return {
        ...group,
    } as AnnotationGroupStrapi;
}