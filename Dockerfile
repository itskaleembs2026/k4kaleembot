# ----------------------------------------------------
# 👑 WhatsApp Super Bot Pro - Cloud Production Dockerfile
# Optimized for Render, Railway, Koyeb, Fly.io & VPS
# ----------------------------------------------------
FROM node:20-bookworm-slim

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production node modules
RUN npm install --omit=dev

# Copy project files
COPY . .

# Create persistent storage directory
RUN mkdir -p auth_info_baileys

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "index.js"]
