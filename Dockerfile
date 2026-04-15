FROM node:20-alpine AS backend-deps
WORKDIR /app/backend-nest
COPY backend-nest/package*.json ./
RUN npm ci

FROM backend-deps AS backend-build
WORKDIR /app/backend-nest
COPY backend-nest/ ./
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

LABEL org.opencontainers.image.title="prescription-system"

RUN apk add --no-cache nginx
RUN mkdir -p /run/nginx /usr/share/nginx/html

RUN cat > /etc/nginx/http.d/default.conf <<'EOF'
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # Allow up to 10MB uploads — matches the multer file size limit in the backend
    client_max_body_size 10M;

    location / {
        try_files $uri $uri/ /index.html;
        # Never cache index.html — ensures mobile always gets the latest chunk filenames
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location /assets/ {
        # JS/CSS assets have content hashes in filenames — cache aggressively
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }

    location /uploads {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
EOF

COPY --from=backend-build /app/backend-nest/dist /app/backend-nest/dist
COPY --from=backend-build /app/backend-nest/node_modules /app/backend-nest/node_modules
COPY --from=backend-build /app/backend-nest/package.json /app/backend-nest/package.json

COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

ENV NODE_ENV=production
ENV PORT=5000
ENV FRONTEND_URL=http://localhost

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1/api/health >/dev/null || exit 1

CMD ["sh", "-c", "nginx && cd /app/backend-nest && node dist/main"]