FROM node:22-alpine@sha256:0e1754758c2df4cfa3e68d59e2e1b7374bb7fd9ea6328eaaacf15cc934af8202
WORKDIR /app
COPY build/server.mjs ./server.mjs
ENV LUNAJAM_HOST=0.0.0.0 LUNAJAM_PORT=8642
USER node
EXPOSE 8642
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -q -O /dev/null "http://127.0.0.1:${LUNAJAM_PORT}/healthz" || exit 1
CMD ["node", "server.mjs"]
