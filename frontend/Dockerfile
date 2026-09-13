# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# VITE_API_BASE_URL is the only runtime-configurable variable.
# All API calls go through Nginx reverse proxy, so in production
# this should be left empty (default) or set to "/api".
# Supabase ARGs are removed — this project no longer uses Supabase.
ARG VITE_API_BASE_URL=""

RUN if [ -n "$VITE_API_BASE_URL" ]; then echo "VITE_API_BASE_URL=$VITE_API_BASE_URL" >> .env; fi

RUN npm run build

# Production Nginx stage
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
