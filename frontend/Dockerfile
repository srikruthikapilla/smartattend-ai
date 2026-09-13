# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_API_BASE_URL=""

# Only append build arguments if explicitly provided
RUN if [ -n "$VITE_SUPABASE_URL" ]; then echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL" >> .env; fi
RUN if [ -n "$VITE_SUPABASE_ANON_KEY" ]; then echo "VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY" >> .env; fi
RUN if [ -n "$VITE_API_BASE_URL" ]; then echo "VITE_API_BASE_URL=$VITE_API_BASE_URL" >> .env; fi

RUN npm run build

# Production Nginx stage
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
