# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Add necessary packages for builds
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

FROM node:20-alpine AS runner

WORKDIR /app

# Add necessary packages for runtime
RUN apk add --no-cache openssl

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Expose application port
EXPOSE 3005

# Start application
CMD ["npm", "run", "start:prod"]
