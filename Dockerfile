FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY index.html app.js ui.js styles.css ui.css design.css portal-actions.js manifest.webmanifest service-worker.js ./
COPY assets ./assets
COPY modules ./modules
COPY scripts ./scripts
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1) )"
CMD ["npm", "start"]
