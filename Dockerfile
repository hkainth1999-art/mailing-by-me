FROM node:22-alpine

WORKDIR /app

# Copy dependency definitions and install all dependencies (including Vite for build)
COPY package*.json ./
RUN npm install

# Copy application source, config, and client code
COPY . .

# Compile React TSX frontend into dist/
RUN npm run build

# Remove development dependencies to keep production image minimal
RUN npm prune --production

# Ensure data directory exists
RUN mkdir -p /app/data

EXPOSE 3000 25 587

ENV NODE_ENV=production
ENV PORT=3000
ENV SMTP_PORT=25
ENV DATA_DIR=/app/data

CMD ["node", "src/server.js"]
