# Use an official Node image
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all files
COPY . .

# Expose the port your bot uses
EXPOSE 3000

# Start your app
CMD ["npm", "run", "dev"]
