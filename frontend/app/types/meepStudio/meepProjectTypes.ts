// meepProjectTypes.ts

import { StrapiResponse } from "../strapiTypes";

// This is the object strapi sends you
// These fields must match the fields in the strapi collection
interface MeepProjectStrapi extends StrapiResponse {
    title: string;
    description?: string;
    customData?: string;         // JSON string for custom data
}

// Fields of the customData object
interface MeepStudioCustomData {
    lastExecution?: string;
    lastExecutionConsoleLogs?: string[];
    pythonCode?: string;
}

// This is the final interface that the frontend will use (note that there is no customData field; this is unpacked now)
interface MeepProject extends MeepStudioCustomData, StrapiResponse {
    // From the StrapiResponse, we inherit the documentId, createdAt, and updatedAt fields
    // We also inherit all the customData fields
    // List all fields here THAT ARE NOT in the customData object or in the StrapiResponse
    title: string;
    description?: string;
}

// Method to deserialize the customData field; converting ExampleStrapi into an Example
function deserializeExample(project: MeepProjectStrapi): MeepProject {
    // Get the customData field and parse it
    const customData = JSON.parse(project.customData ?? '{}') as MeepStudioCustomData;
    return {
        ...project,
        ...customData,
    };
}

// Method to serialize the customData field; converting Example into ExampleStrapi
function serializeExample(project: MeepProject): MeepProjectStrapi {
    // Get the customData field and stringify it
    const customData = JSON.stringify(project);
    return {
        ...project,
        customData,
    } as MeepProjectStrapi;
}