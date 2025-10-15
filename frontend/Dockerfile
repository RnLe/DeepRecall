# Use Node.js 22 image as the base
FROM node:22-alpine

# Install build dependencies for Alpine (required for canvas and other native modules)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev \
    librsvg-dev

# Set the working directory inside the container (subsequent instructions will be executed in this directory)
WORKDIR /app/

# Copy package files for dependency installation
COPY package*.json ./

# Install pnpm globally and install dependencies
RUN npm install -g pnpm
RUN pnpm install

# Copy the rest of the application
COPY . .

# Expose the port used by Next.js
EXPOSE 3000

# Set the command to start the Next.js development server
CMD ["pnpm", "run", "dev"]