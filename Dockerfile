FROM node:20-alpine

# Install curl for healthcheck
RUN apk --no-cache add curl

WORKDIR /app

# Copy package info and install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Expose port
EXPOSE 3000

# Start the application in dev mode via custom server
CMD ["npm", "run", "dev"]
