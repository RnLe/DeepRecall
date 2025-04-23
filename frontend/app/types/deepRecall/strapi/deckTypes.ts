// deckTypes.ts

import { StrapiResponse } from "../../strapiTypes";
import { DeckCardStrapi } from "./deckCardTypes";
import { KnowledgePackStrapi } from "./knowledgePackTypes";

export interface DeckStrapi extends StrapiResponse {
    name: string;
    customData: string; // JSON string
    // Relational data
    // Many-to-many
    knowledge_packs?: {
        data?: KnowledgePackStrapi[];   // for responses
        connect?: string[];             // for POST/PUT
        disconnect?: string[];
        set?: string[];
    };
    // Many-to-many
    deck_cards?: {
        data?: DeckCardStrapi[];        // for responses
        connect?: string[];             // for POST/PUT
        disconnect?: string[];
        set?: string[];
    };
}

// Fields of the customData object
export interface DeckCustomData {
    // add your custom fields here, e.g.:
    // theme?: string;
}

// Unpacked customData into Deck
export interface Deck extends DeckCustomData {
}

// Method to deserialize the customData field; converting DeckStrapi into a Deck
export function deserializeDeck(deck: DeckStrapi): Deck {
    const customData = JSON.parse(deck.customData) as DeckCustomData;
    return {
        ...deck,
        ...customData,
    };
}

// Method to serialize the customData field; converting Deck into a DeckStrapi
export function serializeDeck(deck: Deck): DeckStrapi {
    const customData = JSON.stringify(deck);
    return {
        ...deck,
        customData,
    } as DeckStrapi;
}