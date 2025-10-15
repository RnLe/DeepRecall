// knowledgePackService.ts

import { KnowledgePack, serializeKnowledgePack, deserializeKnowledgePack } from "../types/deepRecall/strapi/knowledgePackTypes";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/knowledge-packs";
const jsonHeaders = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_TOKEN}`,
};

export async function fetchKnowledgePacks(): Promise<KnowledgePack[]> {
  const params = new URLSearchParams();
  params.append("pagination[pageSize]", "1000");
  params.append("sort", "createdAt:asc");

  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error(`Fetch knowledge packs failed: ${res.status}`);

  const json = await res.json();
  return json.data.map((d: any) => deserializeKnowledgePack(d));
}

export async function createKnowledgePack(
  pack: KnowledgePack
): Promise<KnowledgePack> {
  const payload = { data: serializeKnowledgePack(pack) };
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Create knowledge pack failed: ${res.status} – ${JSON.stringify(err)}`);
  }
  const json = await res.json();
  return deserializeKnowledgePack(json.data);
}

export async function updateKnowledgePack(
  id: string,
  pack: KnowledgePack
): Promise<KnowledgePack> {
  const payload = { data: serializeKnowledgePack(pack) };
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Update knowledge pack failed: ${res.status} – ${JSON.stringify(err)}`);
  }
  const json = await res.json();
  return deserializeKnowledgePack(json.data);
}

export async function deleteKnowledgePack(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
    headers: jsonHeaders,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Delete knowledge pack failed: ${res.status} – ${JSON.stringify(err)}`);
  }
}