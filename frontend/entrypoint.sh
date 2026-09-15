#!/bin/sh
set -e

SSL_DIR="/etc/nginx/ssl"
CERT_FILE="$SSL_DIR/cert.pem"
KEY_FILE="$SSL_DIR/key.pem"

mkdir -p "$SSL_DIR"

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "[Nginx SSL] Certificate not found. Generating automatic high-security self-signed certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/C=IN/ST=Telangana/L=Khammam/O=SBIT/OU=SmartAttend/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:0.0.0.0" 2>/dev/null
    echo "[Nginx SSL] Certificate successfully generated at $CERT_FILE"
else
    echo "[Nginx SSL] Using existing certificate from $CERT_FILE"
fi

# Execute original nginx command
exec "$@"
