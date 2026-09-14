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
CMD ["npm", "start"]
