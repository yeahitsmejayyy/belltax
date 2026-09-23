import { PRODUCT_NAME } from "@app/schema";
import { loadConfig } from "./config";

// Placeholder entry; task 04 replaces this with the skelly-backend server.
const config = loadConfig();

const server = Bun.serve({
  port: config.port,
  hostname: "127.0.0.1",
  fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/health") return Response.json({ product: PRODUCT_NAME, mode: config.mode });
    return new Response("Not found", { status: 404 });
  },
});

console.log(`${PRODUCT_NAME} [${config.mode.toUpperCase()}] on ${server.url}`);
