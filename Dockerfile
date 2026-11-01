FROM node:22-alpine

WORKDIR /app

# Copy dependency definitions and install
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source and static UI
COPY src/ ./src/
COPY public/ ./public/

# Ensure data directory exists
RUN mkdir -p /app/data

EXPOSE 3000 25

ENV NODE_ENV=production
ENV PORT=3000
ENV SMTP_PORT=25
ENV DATA_DIR=/app/data

CMD ["node", "src/server.js"]

