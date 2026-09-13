FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server ./server
COPY index.html app.js styles.css ./
COPY assets ./assets
EXPOSE 3000
CMD ["npm", "start"]
