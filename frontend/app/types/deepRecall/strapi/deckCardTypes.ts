// deckCardTypes.ts

import { StrapiResponse } from "../../strapiTypes";
import { AnnotationStrapi } from "./annotationTypes";
import { DeckStrapi } from "./deckTypes";

export interface DeckCardStrapi extends StrapiResponse {
    name: string;
    customData: string;         // JSON string
    // Relational data
    // Many-to-many
    decks?: {
        data?:      DeckStrapi[];      // for responses
        connect?:   string[];          // for POST/PUT
        disconnect?:string[];
        set?:       string[];
    };
    // One to One relation with annotation
    annotation?: AnnotationStrapi;
}

// Fields of the customData object
export interface DeckCardCustomData {
    // add your custom fields here, e.g.:
    // difficulty?: number;
}

// Unpacked customData into DeckCard
export interface DeckCard extends DeckCardCustomData {
}

// Method to deserialize the customData field; converting DeckCardStrapi into a DeckCard
export function deserializeDeckCard(card: DeckCardStrapi): DeckCard {
    const customData = JSON.parse(card.customData) as DeckCardCustomData;
    return {
        ...card,
        ...customData,
    };
}

// Method to serialize the customData field; converting DeckCard into a DeckCardStrapi
export function serializeDeckCard(card: DeckCard): DeckCardStrapi {
    const customData = JSON.stringify(card);
    return {
        ...card,
        customData,
    } as DeckCardStrapi;
}