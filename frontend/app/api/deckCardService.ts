// deckCardService.ts

import { DeckCard, serializeDeckCard, deserializeDeckCard } from "../types/deepRecall/strapi/deckCardTypes";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/deck-cards";
const jsonHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_TOKEN}`,
};

export async function fetchDeckCards(): Promise<DeckCard[]> {
  const params = new URLSearchParams();
  params.append("pagination[pageSize]", "1000");
  params.append("sort", "createdAt:asc");

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error(`Fetch deck cards failed: ${res.status}`);

  const json = await res.json();
  return json.data.map((d: any) => deserializeDeckCard(d));
}

export async function createDeckCard(
  deckCard: DeckCard
): Promise<DeckCard> {
  const payload = { data: serializeDeckCard(deckCard) };
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Create deck card failed: ${res.status} – ${JSON.stringify(err)}`);
  }
  const json = await res.json();
  return deserializeDeckCard(json.data);
}

export async function updateDeckCard(
  id: string,
  deckCard: DeckCard
): Promise<DeckCard> {
  const payload = { data: serializeDeckCard(deckCard) };
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Update deck card failed: ${res.status} – ${JSON.stringify(err)}`);
  }
  const json = await res.json();
  return deserializeDeckCard(json.data);
}

export async function deleteDeckCard(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
    headers: jsonHeaders,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Delete deck card failed: ${res.status} – ${JSON.stringify(err)}`);
  }
}