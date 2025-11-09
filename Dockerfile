# Use an official lightweight Node.js 20 image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the app
COPY . .

# Expose port 3000 for the bot server
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
