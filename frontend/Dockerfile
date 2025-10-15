# Use Node.js 22 Alpine for smaller image size
FROM node:22-alpine

# Set CI environment for pnpm (non-interactive mode)
ENV CI=true

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app/

# Copy entrypoint to root (won't be overwritten by volume mount)
COPY docker-entrypoint.sh /docker-entrypoint.sh
# RUN chmod +x /docker-entrypoint.sh

# Copy package files
COPY package*.json .npmrc ./

# No need to install dependencies here; done in entrypoint to ensure native bindings are built

# Copy application files
COPY . .

# Expose Next.js port
EXPOSE 3000

# Entrypoint ensures dependencies exist in mounted volume
ENTRYPOINT ["/bin/sh", "/docker-entrypoint.sh"]

# Start Next.js dev server
CMD ["pnpm", "run", "dev"]