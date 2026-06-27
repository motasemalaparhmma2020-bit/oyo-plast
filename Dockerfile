# Multi-stage Dockerfile for building and running the Node + TypeScript app
# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files first to leverage Docker cache for dependencies
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies) to run the build
RUN npm ci

# Copy the rest of the repository and run the build script
COPY . .
# The repository's package.json defines `build` -> `tsx script/build.ts`
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app

# Copy only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy built output from the builder stage
COPY --from=builder /app/dist ./dist

# Environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Start the app. Adjust if your entrypoint is different.
CMD ["node", "dist/index.cjs"]
