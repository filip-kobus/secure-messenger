FROM nginx:alpine

RUN apk add --no-cache openssl

COPY nginx.conf /etc/nginx/nginx.conf

COPY generate-ssl.sh /docker-entrypoint.d/99-generate-ssl.sh
RUN chmod +x /docker-entrypoint.d/99-generate-ssl.sh

RUN mkdir -p /etc/nginx/ssl