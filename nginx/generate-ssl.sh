#!/bin/sh

SSL_DIR="/etc/nginx/ssl"
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"

mkdir -p $SSL_DIR

if [ ! -f "$CERT_FILE" ]; then
    echo "SSL certificate not found. Generating self-signed certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/C=PL/ST=State/L=City/O=Organization/CN=localhost"
    echo "SSL certificates generated."
else
    echo "SSL certificates already exist. Skipping generation."
fi