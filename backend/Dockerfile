# Use Node.js 22 image as the base
FROM node:22-alpine

# Install bash (primarily for the wait-for-it.sh script)
RUN apk add --no-cache bash
# Installing libvips-dev for sharp Compatibility
RUN apk update && apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev nasm bash vips-dev git
ARG NODE_ENV=development

# Set the working directory inside the container  (subsequent instructions will be executed in this directory)
WORKDIR /app/

# Copy only package files for dependency installation
COPY package*.json ./

# Install dependencies
RUN npm install -g node-gyp
RUN npm config set fetch-retry-maxtimeout 600000 -g && npm install
ENV PATH=/app/node_modules/.bin:$PATH

# Copy the rest of the application
COPY . .

RUN chown -R node:node /app
USER node
RUN mkdir -p /app/public/uploads && chown -R node:node /app/public/uploads
RUN ["npm", "run", "build"]

# Expose the Strapi development port
EXPOSE 1337

# Set the command to start the Strapi app
CMD ["npm", "run", "develop"]