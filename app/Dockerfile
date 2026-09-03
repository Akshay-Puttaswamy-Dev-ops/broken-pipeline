# The fix was "COPY src ."-app/src/ doesn't exist , source files are at app/root
FROM node:20
WORKDIR /usr/src/application
COPY package*.json ./
RUN npm install
#COPY src
COPY . .
CMD ["node","server.js"]
