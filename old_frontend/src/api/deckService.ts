// src/api/deckService.ts

import { Deck, serializeDeck, deserializeDeck } from "../types/deepRecall/strapi/deckTypes";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/decks";
const jsonHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_TOKEN}`,
};

export async function fetchDecks(): Promise<Deck[]> {
  const params = new URLSearchParams();

  // Pagination and sorting
  params.append("pagination[pageSize]", "1000");
  params.append("sort", "createdAt:asc");

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: jsonHeaders,
  });

  if (!res.ok) throw new Error(`Fetch decks failed: ${res.status}`);

  const json = await res.json();
  // Response is wrapped in a data object
  // Additionally, deserialize the Strapi object into its frontend type
  return json.data.map((d: any) => deserializeDeck(d));
}


export async function createDeck(
  deck: Deck
): Promise<Deck> {
  // Deck has to be wrapped in a data object
  const payload = { data: serializeDeck(deck) };

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      `Create deck failed: ${res.status} – ${JSON.stringify(err)}`
    );
  }
  const json = await res.json();
  // The response is a single object, wrapped in a data array
  return deserializeDeck(json.data);
}

export async function updateDeck(
  documentId: string,
  deck: Deck
): Promise<Deck> {
  // Deck has to be wrapped in a data object
  const payload = { data: serializeDeck(deck) };
  
  const res = await fetch(`${BASE_URL}/${documentId}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      `Update annotation failed: ${res.status} – ${JSON.stringify(err)}`
    );
  }
  const json = await res.json();
  
  return deserializeDeck(json.data);
}

export async function deleteDeck(documentId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/${documentId}`, {
    method: "DELETE",
    headers: jsonHeaders,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      `Delete deck failed: ${res.status} – ${JSON.stringify(err)}`
    );
  }
}
