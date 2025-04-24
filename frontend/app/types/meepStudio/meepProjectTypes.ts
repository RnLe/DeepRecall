// meepProjectTypes.ts

import { StrapiResponse } from "../strapiTypes";

// This is the object strapi sends you
// These fields must match the fields in the strapi collection
export interface MeepProjectStrapi extends StrapiResponse {
    title: string;
    description?: string;
    customMetadata?: string;         // JSON string for custom data
}

// Fields of the customData object
interface MeepStudioCustomData {
    lastExecution?: string;
    lastExecutionConsoleLogs?: string[];
    pythonCode?: string;
}

// This is the final interface that the frontend will use (note that there is no customData field; this is unpacked now)
export interface MeepProject extends MeepStudioCustomData, StrapiResponse {
    // From the StrapiResponse, we inherit the documentId, createdAt, and updatedAt fields
    // We also inherit all the customData fields
    // List all fields here THAT ARE NOT in the customData object or in the StrapiResponse
    title: string;
    description?: string;
}

// Method to deserialize the customData field; converting ExampleStrapi into an Example
export function deserializeMeepProject(project: MeepProjectStrapi): MeepProject {
    const raw = project.customMetadata ?? {};
    const meta = typeof raw === "string"
      ? (raw ? JSON.parse(raw) : {})
      : raw;
    return {
        // StrapiResponse fields
        documentId: project.documentId,
        createdAt:   project.createdAt,
        updatedAt:   project.updatedAt,
        // MeepProject fields
        title:       project.title,
        description: project.description,
        // customData unpacked
        lastExecution:             meta.lastExecution,
        lastExecutionConsoleLogs:  meta.lastExecutionConsoleLogs ?? [],
        pythonCode:                meta.pythonCode,
    };
}

// Method to serialize the customData field; converting Example into ExampleStrapi
export function serializeMeepProject(
  project: MeepProject
): Pick<MeepProjectStrapi, "title" | "description" | "customMetadata"> {
    const {
      title,
      description,
      lastExecution,
      lastExecutionConsoleLogs,
      pythonCode
    } = project;
    const meta = {
      lastExecution,
      lastExecutionConsoleLogs,
      pythonCode
    };
    return {
      title,
      description,
      customMetadata: JSON.stringify(meta)
    };
}