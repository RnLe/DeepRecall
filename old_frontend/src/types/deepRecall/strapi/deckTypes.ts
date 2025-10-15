// deckTypes.ts

import { StrapiResponse } from "../../strapiTypes";
import { DeckCard, DeckCardStrapi, deserializeDeckCard } from "./deckCardTypes";
import { KnowledgePack, KnowledgePackStrapi, deserializeKnowledgePack } from "./knowledgePackTypes";

export interface DeckStrapi extends StrapiResponse {
    name: string;
    customData: string; // JSON string
    // Relational data
    // Many-to-many
    knowledge_packs?: {
        data?:          KnowledgePackStrapi[];
        connect?:       string[];
        disconnect?:    string[];
        set?:           string[];
    };
    // Many-to-many
    deck_cards?: {
        data?:          DeckCardStrapi[];
        connect?:       string[];
        disconnect?:    string[];
        set?:           string[];
    };
}

// Fields of the customData object
export interface DeckCustomData {
    // add custom fields here
}

// Unpacked customData into Deck
export interface Deck extends DeckCustomData, StrapiResponse {
    name: string;
    knowledgePacks?: KnowledgePack[];
    deckCards?: DeckCard[];
}

// Method to deserialize the customData field; converting DeckStrapi into a Deck
export function deserializeDeck(deck: DeckStrapi): Deck {
    const customData = JSON.parse(deck.customData) as DeckCustomData;
    const knowledgePacks = deck.knowledge_packs?.data || [];
    const deckCards = deck.deck_cards?.data || [];
    return {
        ...deck,
        ...customData,
        knowledgePacks: knowledgePacks.map((knowledgePack) => (deserializeKnowledgePack(knowledgePack))) || [],
        deckCards: deckCards.map((deckCard) => (deserializeDeckCard(deckCard))) || [],
    } as Deck;
}

// Method to serialize the customData field; converting Deck into a DeckStrapi
export function serializeDeck(deck: Deck): DeckStrapi {
    const customData = JSON.stringify(deck);
    return {
        ...deck,
        customData,
        knowledge_packs: {
            set: deck.knowledgePacks?.map((knowledgePack) => knowledgePack.documentId) || [],
        },
        deck_cards: {
            set: deck.deckCards?.map((deckCard) => deckCard.documentId) || [],
        },
    } as DeckStrapi;
}