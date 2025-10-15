// deckCardTypes.ts

import { StrapiResponse } from "../../strapiTypes";
import { Annotation, AnnotationStrapi, deserializeAnnotation } from "./annotationTypes";
import { Deck, DeckStrapi, deserializeDeck } from "./deckTypes";

export interface DeckCardStrapi extends StrapiResponse {
    name: string;
    customData: string;         // JSON string
    // Relational data
    // Many-to-many
    decks?: {
        data?:      DeckStrapi[];
        connect?:   string[];
        disconnect?:string[];
        set?:       string[];
    };
    // One to One relation with annotation
    annotation?: {
        data?:      AnnotationStrapi;
        connect?:   string;
        disconnect?:string;
        set?:       string;
    };
}

// Fields of the customData object
export interface DeckCardCustomData {
    // add custom fields here
}

// Unpacked customData into DeckCard
export interface DeckCard extends DeckCardCustomData, StrapiResponse {
    name: string;
    decks?: Deck[];
    annotation?: Annotation;
}

// Method to deserialize the customData field; converting DeckCardStrapi into a DeckCard
export function deserializeDeckCard(card: DeckCardStrapi): DeckCard {
    const customData = JSON.parse(card.customData) as DeckCardCustomData;
    const decks = card.decks?.data || [];
    const annotation = card.annotation?.data || undefined;
    return {
        ...card,
        ...customData,
        decks: decks.map((deck) => (deserializeDeck(deck))) || [],
        annotation: annotation ? deserializeAnnotation(annotation) : undefined,
    } as DeckCard;
}

// Method to serialize the customData field; converting DeckCard into a DeckCardStrapi
export function serializeDeckCard(card: DeckCard): DeckCardStrapi {
    const customData = JSON.stringify(card);
    const deckIds = card.decks?.map((deck) => deck.documentId) || [];
    const annotationId = card.annotation ? card.annotation.documentId : undefined;
    return {
        ...card,
        customData,
        decks: {
            set: deckIds,
        },
        annotation: {
            set: annotationId ? [annotationId] : undefined,
        },
    } as DeckCardStrapi;
}