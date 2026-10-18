import { isPrivatePath } from "../lib/private-paths.mjs";
import { SECURITY_HEADERS } from "../lib/response-policy.mjs";

export async function onRequest(context) {
  const original = isPrivatePath(new URL(context.request.url).pathname)
    ? new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" } })
    : await context.next();
  const response = new Response(original.body, original);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (name === "Content-Security-Policy" && response.headers.has(name)) continue;
    response.headers.set(name, value);
  }
  return response;
}
