# =============================================================================
# Simulation Engine — Dockerfile (Placeholder)
# =============================================================================
# This is a standalone Node.js service for running the race simulation logic.
# It runs independently from the Next.js web app so it can be scaled
# separately for CPU-intensive calculations.
# =============================================================================

FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

# TODO(security): Run as non-root user in production
# RUN addgroup --system --gid 1001 simgroup && \
#     adduser --system --uid 1001 simuser
# USER simuser

EXPOSE 4000

CMD ["node", "index.js"]
