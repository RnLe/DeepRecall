// scripts.ts
import { Script, ScriptVersionPayload } from "../helpers/mediaTypes";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/scripts";
const BASE_VERSION_URL = "http://localhost:1337/api/script-versions";

export interface ScriptResponse {
  data: Script[];
}

// Fetch Scripts including Authors + ScriptVersions
export const fetchScripts = async (): Promise<Script[]> => {
  const params = new URLSearchParams();
  params.append('populate[0]', 'authors');
  params.append('populate[1]', 'script_versions');
  // Wildcard-populate all fields of each relation:
  params.append('populate[authors][populate]', '*');
  params.append('populate[script_versions][populate]', '*');

  const response = await fetch(`${BASE_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
  }

  const json: ScriptResponse = await response.json();
  console.log(json.data);
  return json.data;
};

/**
 * Creates a new script entry.
 * @param scriptData - Object with script fields (e.g., title)
 * @returns The created script entry.
 */
export const createScript = async (
  scriptData: Omit<Script, "id">
): Promise<Script> => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ data: scriptData }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
  }
  const json = await response.json();
  return json.data;
};

/**
 * Creates a new script version entry linked to an existing script.
 * @param versionData - Object with script version fields, including the related script_id.
 * @returns The created script version entry.
 */
export const createScriptVersion = async (
  versionData: Omit<ScriptVersionPayload, "id">
): Promise<ScriptVersionPayload> => {
  const response = await fetch(BASE_VERSION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ data: versionData }),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    console.error("API Error", response.status, errorBody);
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(errorBody)}`);
  }
  const json = await response.json();
  return json.data;
};
