# ==========================================
# STAGE 1: Build the Next.js Static Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend packages and lockfiles
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source files
COPY frontend/ ./

# Compile Next.js production HTML static export (outputs to /app/frontend/out)
RUN npm run build

# ==========================================
# STAGE 2: Package Express.js Backend & Runner
# ==========================================
FROM node:20-slim AS runner
WORKDIR /app

# Install standard Linux packages required for native node module compilation (sqlite, argon2, better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy backend packages and lockfiles
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend codebase
COPY index.js ./
COPY db/ ./db/
COPY middleware/ ./middleware/
COPY routes/ ./routes/
COPY services/ ./services/
COPY storage/ ./storage/
COPY public/ ./public/

# Ensure SQLite storage data directory exists inside the container
RUN mkdir -p data

# Copy the pre-compiled static frontend from Stage 1 into the backend serving path
COPY --from=frontend-builder /app/frontend/out ./frontend/out

# Expose default port
EXPOSE 3000

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Run Express server
CMD ["node", "index.js"]
