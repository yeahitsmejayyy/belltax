# The hosted public demo (ticket 15, docs/demo-deploy.md). Invented data only: it boots in demo mode, seeds
# 25 invented households, refuses uploads and re-seeds on a timer. There is no live configuration of this image.

# Build the portal (at /) and the admin (at /admin/, mounted on the same port).
FROM oven/bun:1.3.14 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
# Link previews need the public address: PUBLIC_ORIGIN if set, else Render's own RENDER_EXTERNAL_URL.
ARG PUBLIC_ORIGIN
ARG RENDER_EXTERNAL_URL
RUN bun --filter @app/portal build && ADMIN_BASE=/admin/ bun --filter @app/admin build

# Run: the server's source, the two builds, production dependencies only.
FROM oven/bun:1.3.14
WORKDIR /app
COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/packages/schema packages/schema
COPY --from=build /app/packages/ui/package.json packages/ui/package.json
COPY --from=build /app/apps/server apps/server
COPY --from=build /app/apps/portal/package.json apps/portal/package.json
COPY --from=build /app/apps/portal/dist apps/portal/dist
COPY --from=build /app/apps/admin/package.json apps/admin/package.json
COPY --from=build /app/apps/admin/dist apps/admin/dist
COPY --from=build /app/apps/site/package.json apps/site/package.json
RUN bun install --frozen-lockfile --production && mkdir -p data && chown -R bun:bun data

ENV RUN_MODE=demo
ENV DEMO_PUBLIC=1
ENV DEMO_RESET_HOURS=6
ENV PORT=3000
USER bun
EXPOSE 3000
HEALTHCHECK CMD bun -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["bun", "apps/server/src/index.ts"]
