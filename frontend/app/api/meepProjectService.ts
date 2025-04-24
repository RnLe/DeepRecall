// src/api/meepProjectService.ts
import { MeepProject, serializeMeepProject, deserializeMeepProject } from "../types/meepStudio/strapi/meepProjectTypes";
  
  /* -------------------- Strapi config -------------------- */
  const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
  const BASE_URL = "http://localhost:1337/api/meep-projects";
  const jsonHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_TOKEN}`,
  };
  
  /* -------------------- CRUD helpers -------------------- */
  export async function fetchProjects(): Promise<MeepProject[]> {
    const res = await fetch(`${BASE_URL}?pagination[pageSize]=1000&sort=createdAt:asc`, {
      headers: jsonHeaders,
    });
    if (!res.ok) throw new Error(`Fetch projects failed: ${res.status}`);
    const json = await res.json();
    return json.data.map(deserializeMeepProject);
  }
  
  export async function createProject(p: MeepProject): Promise<MeepProject> {
    const payload = { data: serializeMeepProject(p) };
    console.log("payload", payload);
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json();
        console.error("Strapi create error:", err);
        throw new Error(`Create project failed: ${res.status} – ${JSON.stringify(err)}`);
    }
      
    const json = await res.json();
    return deserializeMeepProject(json.data);
  }
  
  export async function updateProject({
    documentId,
    project,
  }: {
    documentId: string;
    project: MeepProject;
  }): Promise<MeepProject> {
    const payload = { data: serializeMeepProject(project) };
    const res = await fetch(`${BASE_URL}/${documentId}`, {
      method: "PUT",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
    const json = await res.json();
    return deserializeMeepProject(json.data);
  }
  
  export async function deleteProject(id: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: "DELETE",
      headers: jsonHeaders,
    });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  }