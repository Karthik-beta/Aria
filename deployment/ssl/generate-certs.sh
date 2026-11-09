#!/bin/sh
# SSL Certificate Generation Script
# Generates self-signed SSL certificates for all available IP addresses
# Suitable for private network deployments

set -e

# Configuration
CERT_DIR="${CERT_DIR:-/certs}"
DAYS="${DAYS:-365}"
KEY_SIZE="${KEY_SIZE:-2048}"
DOMAIN="${DOMAIN:-localhost}"
COUNTRY="${COUNTRY:-US}"
STATE="${STATE:-State}"
LOCALITY="${LOCALITY:-City}"
ORGANIZATION="${ORGANIZATION:-Aria ERP}"
ORG_UNIT="${ORG_UNIT:-IT Department}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo "${RED}[ERROR]${NC} $1"
}

# Create certificate directory
log_info "Creating certificate directory: $CERT_DIR"
mkdir -p "$CERT_DIR"

# Function to get all IP addresses
get_ip_addresses() {
    # Try multiple methods to get IP addresses
    IPS=""
    
    # Method 1: ip command (modern Linux)
    if command -v ip >/dev/null 2>&1; then
        IPS=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' | head -1)
        if [ -z "$IPS" ]; then
            IPS=$(ip addr show 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1')
        fi
    fi
    
    # Method 2: hostname command
    if [ -z "$IPS" ] && command -v hostname >/dev/null 2>&1; then
        IPS=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -v '^$')
    fi
    
    # Method 3: ifconfig (older systems)
    if [ -z "$IPS" ] && command -v ifconfig >/dev/null 2>&1; then
        IPS=$(ifconfig 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1')
    fi
    
    # Fallback to localhost
    if [ -z "$IPS" ]; then
        log_warn "Could not detect IP addresses, using localhost only"
        IPS="127.0.0.1"
    fi
    
    echo "$IPS"
}

# Generate certificates
generate_certificates() {
    log_info "Generating SSL certificates for domain: $DOMAIN"
    
    # Get all IP addresses
    IPS=$(get_ip_addresses)
    
    log_info "Detected IP addresses:"
    echo "$IPS" | while read -r ip; do
        log_info "  - $ip"
    done
    
    # Build Subject Alternative Names (SAN) entries
    SAN_DNS="DNS.1 = ${DOMAIN}
DNS.2 = *.${DOMAIN}
DNS.3 = localhost"
    
    SAN_IPS=""
    counter=1
    echo "$IPS" | while read -r ip; do
        if [ -n "$ip" ]; then
            SAN_IPS="${SAN_IPS}IP.${counter} = ${ip}\n"
            counter=$((counter + 1))
        fi
    done
    SAN_IPS="${SAN_IPS}IP.${counter} = 127.0.0.1"
    
    # Create OpenSSL configuration file
    log_info "Creating OpenSSL configuration..."
    cat > "$CERT_DIR/openssl.conf" <<EOF
[req]
default_bits = $KEY_SIZE
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req
x509_extensions = v3_ca

[dn]
C=$COUNTRY
ST=$STATE
L=$LOCALITY
O=$ORGANIZATION
OU=$ORG_UNIT
CN=$DOMAIN

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment, keyAgreement
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names

[v3_ca]
basicConstraints = CA:TRUE
keyUsage = digitalSignature, keyEncipherment, keyCertSign
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names

[alt_names]
$SAN_DNS
$(echo "$SAN_IPS")
EOF
    
    # Generate private key
    log_info "Generating private key..."
    openssl genrsa -out "$CERT_DIR/server.key" $KEY_SIZE 2>/dev/null
    
    # Generate certificate
    log_info "Generating certificate..."
    openssl req -new -x509 \
        -key "$CERT_DIR/server.key" \
        -out "$CERT_DIR/server.crt" \
        -days $DAYS \
        -config "$CERT_DIR/openssl.conf" \
        -extensions v3_req 2>/dev/null
    
    # Set appropriate permissions
    chmod 600 "$CERT_DIR/server.key"
    chmod 644 "$CERT_DIR/server.crt"
    
    # Generate DH parameters for better security (optional, takes time)
    if [ "${GENERATE_DH:-false}" = "true" ]; then
        log_info "Generating Diffie-Hellman parameters (this may take a while)..."
        openssl dhparam -out "$CERT_DIR/dhparam.pem" 2048 2>/dev/null
        chmod 644 "$CERT_DIR/dhparam.pem"
    fi
    
    log_info "${GREEN}✓${NC} SSL certificates generated successfully!"
    log_info ""
    log_info "Certificate details:"
    log_info "  Certificate: $CERT_DIR/server.crt"
    log_info "  Private Key: $CERT_DIR/server.key"
    log_info "  Valid for: $DAYS days"
    log_info "  Algorithm: RSA $KEY_SIZE bits"
    log_info ""
    log_info "Certificate information:"
    openssl x509 -in "$CERT_DIR/server.crt" -noout -subject -issuer -dates 2>/dev/null
    log_info ""
    log_info "Subject Alternative Names:"
    openssl x509 -in "$CERT_DIR/server.crt" -noout -text 2>/dev/null | grep -A 1 "Subject Alternative Name"
}

# Main execution
main() {
    log_info "Starting SSL certificate generation..."
    log_info "Configuration:"
    log_info "  Domain: $DOMAIN"
    log_info "  Certificate directory: $CERT_DIR"
    log_info "  Validity period: $DAYS days"
    log_info "  Key size: $KEY_SIZE bits"
    log_info ""
    
    # Check if OpenSSL is installed
    if ! command -v openssl >/dev/null 2>&1; then
        log_error "OpenSSL is not installed. Please install it first."
        exit 1
    fi
    
    # Generate certificates
    generate_certificates
    
    log_info "${GREEN}✓${NC} Certificate generation completed!"
}

# Run main function
main "$@"
