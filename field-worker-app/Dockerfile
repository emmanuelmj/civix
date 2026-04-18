FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

RUN npx expo export --platform web

EXPOSE 3001

CMD ["npx", "serve", "dist", "-l", "3001"]
