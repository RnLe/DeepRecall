// knowledgePackTypes.ts

import { StrapiResponse } from "../../strapiTypes";
import { Deck, DeckStrapi, deserializeDeck } from "./deckTypes";

export interface KnowledgePackStrapi extends StrapiResponse {
    name: string;
    intention: string;
    goals: string;
    targetDate: Date;
    customData: string; // JSON string
    // Relational data
    decks?: {
        data?:          DeckStrapi[];
        connect?:       string[];
        disconnect?:    string[];
        set?:           string[];
    };
}

// Fields of the customData object
export interface KnowledgePackCustomData {
    // Empty for now. Add custom fields here.
}

// Unpacked customData into KnowledgePack
export interface KnowledgePack extends KnowledgePackCustomData, StrapiResponse {
    name: string;
    intention: string;
    goals: string;
    targetDate: Date;
    decks?: Deck[];
}

// Method to deserialize the customData field; converting KnowledgePackStrapi into a KnowledgePack
export function deserializeKnowledgePack(knowledgePack: KnowledgePackStrapi): KnowledgePack {
    const customData = JSON.parse(knowledgePack.customData) as KnowledgePackCustomData;
    const decks = knowledgePack.decks?.data || [];
    return {
        ...knowledgePack,
        ...customData,
        decks: decks.map((deck) => (deserializeDeck(deck))) || [],
    } as KnowledgePack;
}

// Method to serialize the customData field; converting KnowledgePack into KnowledgePackStrapi
export function serializeKnowledgePack(knowledgePack: KnowledgePack): KnowledgePackStrapi {
    const customData = JSON.stringify(knowledgePack);
    const deckIds = knowledgePack.decks?.map((deck) => deck.documentId) || [];
    return {
        ...knowledgePack,
        customData,
        decks: {
            set: deckIds,
        },
    } as KnowledgePackStrapi;
}