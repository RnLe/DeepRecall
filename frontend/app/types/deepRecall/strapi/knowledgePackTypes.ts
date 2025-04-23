// knowledgePackTypes.ts

import { StrapiResponse } from "../../strapiTypes";
import { DeckStrapi } from "./deckTypes";

export interface KnowledgePackStrapi extends StrapiResponse {
    name: string;
    intention: string;
    goals: string;
    targetDate: Date;
    customData: string; // JSON string
    // Relational data
    decks?: {
        data?: DeckStrapi[]; // for responses
        connect?: string[]; // for POST/PUT
        disconnect?: string[];
        set?: string[];
    };
}

// Fields of the customData object
export interface KnowledgePackCustomData {
    name?: string;
}

// Unpacked customData into KnowledgePack
export interface KnowledgePack extends KnowledgePackCustomData {
}

// Method to deserialize the customData field; converting KnowledgePackStrapi into a KnowledgePack
export function deserializeKnowledgePack(knowledgePack: KnowledgePackStrapi): KnowledgePack {
    const customData = JSON.parse(knowledgePack.customData) as KnowledgePackCustomData;
    return {
        ...knowledgePack,
        ...customData,
    };
}

// Method to serialize the customData field; converting KnowledgePack into KnowledgePackStrapi
export function serializeKnowledgePack(knowledgePack: KnowledgePack): KnowledgePackStrapi {
    const customData = JSON.stringify(knowledgePack);
    return {
        ...knowledgePack,
        customData,
    } as KnowledgePackStrapi;
}