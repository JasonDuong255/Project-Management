FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# v3.18 (21/05/2026): prisma generate viết generated client vào node_modules/.prisma/client
# - cần copy node_modules từ stage này (không phải từ deps) ở stage runtime
# - không thì runtime gặp lỗi "@prisma/client did not initialize yet".
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# v3.19 (21/05/2026): Prisma engine cần libssl. Alpine 3.20 base có sẵn
# OpenSSL 3 nhưng đôi khi không expose libssl symlink — install openssl
# package explicit để guarantee. ca-certificates cho TLS outbound.
RUN apk add --no-cache openssl ca-certificates
# Copy từ build stage để có cả prisma generated client.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
EXPOSE 4000
CMD ["node", "dist/server.js"]
