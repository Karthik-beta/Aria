# SSL Certificate Generator - Dockerfile 🔐
# Alpine-based container for generating SSL certificates 🧾

FROM alpine:3.24

# Install OpenSSL 🔧
RUN apk add --no-cache \
    openssl \
    bash

# Copy certificate generation script 📜
COPY generate-certs.sh /usr/local/bin/generate-certs.sh

# Make script executable ⚙️
RUN chmod +x /usr/local/bin/generate-certs.sh

# Set working directory 📁
WORKDIR /certs

# Default environment variables 🔒
ENV CERT_DIR=/certs \
    DAYS=365 \
    KEY_SIZE=2048 \
    DOMAIN=localhost \
    COUNTRY=US \
    STATE=State \
    LOCALITY=City \
    ORGANIZATION="Aria ERP" \
    ORG_UNIT="IT Department"

# Volume for certificates 📦
VOLUME ["/certs"]

# Run certificate generation script ▶️
ENTRYPOINT ["/usr/local/bin/generate-certs.sh"]
