// strapiExample.ts

import { StrapiResponse } from "./strapiTypes";

// ------------------- THESE ARE USUALLY IMPORTS -------------------

// Example interfaces to imitate other strapi collections (to include relations in this example)
// Note that these have the strapi response fields and format
// Many-to-many relation
interface ExampleManyToManyCollectionStrapi extends StrapiResponse {
    name: string;
}

// One-to-one relation
interface ExampleOneToOneCollectionStrapi extends StrapiResponse {
    name: string;
}

// Each of these collections has a function to be converted (serialize/deserialize) into its frontend object
// In the final Example interface/object, we want to use these frontend objects instead of the nested strapi objects
// We imitate these functions here

interface ExampleManyToManyCollection extends StrapiResponse {
    name: string;
}

interface ExampleOneToOneCollection extends StrapiResponse {
    name: string;
}

// Serialization functions
function deserializeExampleManyToManyCollection(collection: ExampleManyToManyCollectionStrapi): ExampleManyToManyCollection {
    return {
        ...collection,
    } as ExampleManyToManyCollection;
}

function serializeExampleManyToManyCollection(collection: ExampleManyToManyCollection): ExampleManyToManyCollectionStrapi {
    return {
        ...collection,
    } as ExampleManyToManyCollectionStrapi;
}

function deserializeExampleOneToOneCollection(collection: ExampleOneToOneCollectionStrapi): ExampleOneToOneCollection {
    return {
        ...collection,
    } as ExampleOneToOneCollection;
}

function serializeExampleOneToOneCollection(collection: ExampleOneToOneCollection): ExampleOneToOneCollectionStrapi {
    return {
        ...collection,
    } as ExampleOneToOneCollectionStrapi;
}

// ------------------- END OF EXAMPLE IMPORTS -------------------

// This is the object strapi sends you
// These fields must match the fields in the strapi collection
interface ExampleStrapi extends StrapiResponse {
    name: string;
    customData: string;         // JSON string for custom data
    // Relational data
    // Many-to-many
    manyToMany?: {
        data?:      ExampleManyToManyCollectionStrapi[];
        connect?:   string[];       // ADDS new relationships without affecting existing ones
        disconnect?:string[];       // REMOVES relationships without affecting existing ones
        set?:       string[];       // REPLACES all relationships with the provided ones
    };
    // One to One relation with annotation
    oneToOne?: {
        data?:      ExampleOneToOneCollectionStrapi;
        connect?:   string;         // ADDS new relationship (and deleting the old one?)
        disconnect?:string;         // REMOVES relationship
        set?:       string;         // REPLACES the relationship with the provided one
    };
}

// Fields of the customData object
interface ExampleCustomData {
    // add your custom fields here
    exampleField?: string;
}

// This is the final interface that the frontend will use (note that there is no customData field; this is unpacked now)
// customData is unpacked into the Example interface
interface Example extends ExampleCustomData, StrapiResponse {
    // From the StrapiResponse, we inherit the documentId, createdAt, and updatedAt fields
    // We also inherit all the customData fields
    // List all fields here that are not in the customData object or in the StrapiResponse (note that we dont inherit ExampleStrapi, because we dont want to expose the customData and relation fields)
    name: string;
    manyToMany?: ExampleManyToManyCollection[];
    oneToOne?: ExampleOneToOneCollection;
}

// Method to deserialize the customData field; converting ExampleStrapi into an Example
function deserializeExample(card: ExampleStrapi): Example {
    // Get the customData field and parse it
    const customData = JSON.parse(card.customData) as ExampleCustomData;
    // Fetch the manyToMany relation
    // Note that these are not populated by default, so we need to check if they exist
    const manyToMany = card.manyToMany?.data || [];
    const oneToOne = card.oneToOne?.data || undefined;
    return {
        ...card,
        ...customData,
        manyToMany: manyToMany.map((collection) => ({
            ...deserializeExampleManyToManyCollection(collection), // Deserialize each collection
        })),
        // Deserialize the oneToOne relation
        oneToOne: oneToOne ? deserializeExampleOneToOneCollection(oneToOne) : undefined,
    };
}

// Method to serialize the customData field; converting Example into ExampleStrapi
function serializeExample(card: Example): ExampleStrapi {
    // Get the customData field and stringify it
    const customData = JSON.stringify(card);
    // Get a list of documentIds from the manyToMany relation
    const manyToManyIds = card.manyToMany?.map((collection) => collection.documentId) || [];
    // Get the oneToOne relation
    const oneToOneId = card.oneToOne ? card.oneToOne.documentId : undefined;
    return {
        ...card,
        customData,
        // Using the set field replaces all relationships with the provided ones
        manyToMany: {
            set: manyToManyIds,
        },
        oneToOne: {
            set: oneToOneId,
        },
    } as ExampleStrapi;
}