/**
 * Public health probe for load balancers, docker healthchecks, and uptime
 * monitors. Intentionally lightweight: no DB round-trip so a database
 * blip does not flap the whole fleet. Deeper checks live in /api/public/ready.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          JSON.stringify({
            status: "ok",
            uptime_s: Math.round(process.uptime?.() ?? 0),
            time: new Date().toISOString(),
            version: process.env.APP_VERSION ?? "dev",
          }),
          { headers: { "content-type": "application/json", "cache-control": "no-store" } },
        ),
    },
  },
});
