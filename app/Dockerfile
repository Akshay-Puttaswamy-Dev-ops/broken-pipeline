FROM node:20
WORKDIR /usr/src/application
COPY package*.json ./
RUN npm install
COPY src .
CMD ["node","server.js"]
