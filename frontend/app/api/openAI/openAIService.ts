// openAIService.ts

import { OpenAIPrompt, OpenAIRequest, PromptKey, PromptTemplates } from "./promptTypes";

// Available models
export const availableModels = [
    { name: "gpt-4o",       description: "GPT-4o",          input: 2.50, output: 10.00 },
    { name: "gpt-4o-mini",  description: "GPT-4o mini",     input: 0.15, output: 0.60 },
    { name: "gpt-4.1",      description: "GPT-4.1",         input: 2.00, output: 8.00 },
    { name: "gpt-4.1-mini", description: "GPT-4.1 mini",    input: 0.40, output: 1.60 },
    { name: "gpt-4.1-nano", description: "GPT-4.1 nano",    input: 0.10, output: 0.40 },
    { name: "o4-mini",      description: "o4 mini",         input: 1.10, output: 4.40 },
];

const pythonAPIKey = process.env.NEXT_PUBLIC_PYTHON_API_URL;

export async function executeOpenAIRequest(
    promptKey: PromptKey,
    model: string,
    images?: File[]): Promise<string> {

        // safely grab the exact template
        const prompt = PromptTemplates[promptKey];

        // build a FormData instead of a JSON body (jsonstringify converts files to a json object with not data)
        const formData = new FormData();
        formData.append("developerRolePrompt", prompt.developerRolePrompt);
        formData.append("userRolePrompt",    prompt.userRolePrompt);
        formData.append("model",             model);

        if (images) {
            for (const img of images) {
            // the name "images" matches the server parameter
            formData.append("images", img, img.name);
            }
        }

        const res = await fetch(`${pythonAPIKey}/deepRecall/openai`, {
            method: "POST",
            // IMPORTANT: do NOT set Content-Type; the browser will set
            // multipart/form-data with the proper boundary for you.
            body: formData,
        });

        // parse the response body
        let payload: any;
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            payload = await res.json();
        } else {
            payload = await res.text();
        }

        // if FastAPI returned a 4xx/5xx, payload.detail holds your message
        if (!res.ok) {
            // if payload is an object with .detail, use it; otherwise stringify
            const msg =
            typeof payload === "object" && "detail" in payload
                ? payload.detail
                : String(payload);
            throw new Error(`(${res.status}) ${msg}`);
        }

        // otherwise payload is your actual successful response
        return typeof payload === "string" ? payload : JSON.stringify(payload);
}