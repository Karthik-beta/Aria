#!/bin/bash
# Aria ERP - SSL Certificate Generation Script for Linux
# Generates self-signed certificate with all server IP addresses in SAN
# For path-based routing deployment

set -e

# Configuration
CERT_DIR="${1:-./volumes/traefik}"
CERT_VALIDITY_DAYS=365
CERT_KEY_SIZE=4096

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if openssl is installed
if ! command -v openssl &> /dev/null; then
    error "OpenSSL is not installed. Please install it first."
    exit 1
fi

info "Generating SSL certificate with all server IP addresses..."

# Create cert directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Detect all IP addresses on this server
info "Detecting server IP addresses..."
IP_ADDRESSES=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1')
IPV6_ADDRESSES=$(ip -6 addr show | grep -oP '(?<=inet6\s)[0-9a-f:]+' | grep -v '^::1' | grep -v '^fe80')

# Create OpenSSL configuration
OPENSSL_CONF="$CERT_DIR/openssl.conf"
cat > "$OPENSSL_CONF" << 'EOF'
[req]
default_bits       = 4096
distinguished_name = req_distinguished_name
x509_extensions    = v3_req
prompt             = no

[req_distinguished_name]
C  = US
ST = State
L  = City
O  = Aria ERP
OU = IT Department
CN = Aria ERP Server

[v3_req]
keyUsage = critical, digitalSignature, keyEncipherment, keyAgreement
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names
basicConstraints = critical, CA:FALSE

[alt_names]
DNS.1 = localhost
DNS.2 = aria.local
IP.1  = 127.0.0.1
IP.2  = ::1
EOF

# Add detected IP addresses to configuration
IP_INDEX=3
info "Adding IP addresses to certificate:"
for ip in $IP_ADDRESSES; do
    echo "IP.$IP_INDEX = $ip" >> "$OPENSSL_CONF"
    info "  - IPv4: $ip"
    ((IP_INDEX++))
done

# Add IPv6 addresses
IP6_INDEX=10
for ip6 in $IPV6_ADDRESSES; do
    echo "IP.$IP6_INDEX = $ip6" >> "$OPENSSL_CONF"
    info "  - IPv6: $ip6"
    ((IP6_INDEX++))
done

# Read domain if provided
read -p "Enter domain name (press Enter to skip): " DOMAIN_NAME
if [ -n "$DOMAIN_NAME" ]; then
    echo "DNS.3 = $DOMAIN_NAME" >> "$OPENSSL_CONF"
    info "  - Domain: $DOMAIN_NAME"
fi

# Generate certificate
info "Generating certificate and private key..."
openssl req -new -x509 -nodes \
    -days "$CERT_VALIDITY_DAYS" \
    -keyout "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -config "$OPENSSL_CONF" \
    2>/dev/null

# Set proper permissions
chmod 600 "$CERT_DIR/server.key"
chmod 644 "$CERT_DIR/server.crt"

# Display certificate information
info "Certificate generated successfully!"
info "Certificate details:"
openssl x509 -in "$CERT_DIR/server.crt" -noout -text | grep -A1 "Subject Alternative Name"

echo ""
info "Certificate files:"
info "  - Certificate: $CERT_DIR/server.crt"
info "  - Private Key: $CERT_DIR/server.key"
info "  - Configuration: $CERT_DIR/openssl.conf"
echo ""
info "Certificate is valid for $CERT_VALIDITY_DAYS days"
info "Certificate includes all detected server IP addresses"
echo ""
warn "Note: This is a self-signed certificate. Browsers will show a security warning."
warn "For production, consider using Let's Encrypt or a commercial CA."
echo ""
info "Access your Aria ERP deployment at:"
for ip in $IP_ADDRESSES; do
    info "  https://$ip/asset/  (or /crm/, /hrms/, /inventory/, /api/)"
done
if [ -n "$DOMAIN_NAME" ]; then
    info "  https://$DOMAIN_NAME/asset/"
fi

exit 0
