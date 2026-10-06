import { SECURITY_HEADERS } from "../lib/response-policy.mjs";

export async function onRequest(context) {
  const original = await context.next();
  const response = new Response(original.body, original);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (name === "Content-Security-Policy" && response.headers.has(name)) continue;
    response.headers.set(name, value);
  }
  return response;
}
