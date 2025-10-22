# Use Node.js 22 Alpine for smaller image size
FROM node:22-alpine

# Set CI environment for pnpm (non-interactive mode)
ENV CI=true

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory to workspace root
WORKDIR /workspace

# Copy workspace config files (no root package.json in this workspace)
COPY pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy package.json files from all packages
COPY packages/core/package.json ./packages/core/
COPY packages/data/package.json ./packages/data/
COPY packages/ui/package.json ./packages/ui/
COPY packages/pdf/package.json ./packages/pdf/

# Copy apps/web package.json and config
COPY apps/web/package.json apps/web/.npmrc ./apps/web/

# Copy entrypoint
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Install dependencies will happen in entrypoint

# Expose Next.js port
EXPOSE 3000

# Set working directory to web app
WORKDIR /workspace/apps/web

# Entrypoint ensures dependencies exist in mounted volume
ENTRYPOINT ["/bin/sh", "/docker-entrypoint.sh"]

# Start Next.js dev server
CMD ["pnpm", "run", "dev"]