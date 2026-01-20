#!/bin/bash

mkdir -p ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ssl/key.pem \
    -out ssl/cert.pem \
    -subj "/C=PL/ST=State/L=City/O=Organization/CN=localhost"

echo "SSL certificates generated in nginx/ssl/"
