# Use Node.js 22 image as the base
FROM node:22-alpine

# Set the working directory inside the container (subsequent instructions will be executed in this directory)
WORKDIR /app/

# Copy only package files for dependency installation
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port used by Next.js
EXPOSE 3000

# Set the command to start the Next.js development server
CMD ["npm", "run", "dev"]