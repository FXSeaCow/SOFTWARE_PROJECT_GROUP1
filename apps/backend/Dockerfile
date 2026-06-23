FROM node:20-alpine

WORKDIR /app

COPY apps/backend/package.json ./package.json

RUN npm install
RUN npm install qrcode

COPY apps/backend ./

EXPOSE 3000

CMD ["node", "server.js"]
