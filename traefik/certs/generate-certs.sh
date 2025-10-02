#!/bin/bash

# Certificate Generation Script for Aria ERP Static IP Deployments
# This script generates self-signed certificates with IP SAN for HTTPS support

set -e

# Configuration
STATIC_IP=${1:-192.168.1.100}
CERT_DIR="$(dirname "$0")"
CERT_NAME="server"
VALIDITY_DAYS=365
KEY_SIZE=4096

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to validate IP address
validate_ip() {
    local ip=$1
    if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        IFS='.' read -ra ADDR <<< "$ip"
        for i in "${ADDR[@]}"; do
            if [[ $i -gt 255 ]]; then
                return 1
            fi
        done
        return 0
    else
        return 1
    fi
}

# Function to check if OpenSSL is installed
check_openssl() {
    if ! command -v openssl &> /dev/null; then
        print_error "OpenSSL is not installed. Please install it first."
        exit 1
    fi
}

# Function to create certificate directory
create_cert_dir() {
    if [[ ! -d "$CERT_DIR" ]]; then
        print_info "Creating certificate directory: $CERT_DIR"
        mkdir -p "$CERT_DIR"
    fi
}

# Function to backup existing certificates
backup_existing_certs() {
    if [[ -f "$CERT_DIR/$CERT_NAME.crt" ]] || [[ -f "$CERT_DIR/$CERT_NAME.key" ]]; then
        local backup_dir="$CERT_DIR/backup_$(date +%Y%m%d_%H%M%S)"
        print_warning "Existing certificates found. Creating backup in: $backup_dir"
        mkdir -p "$backup_dir"
        
        if [[ -f "$CERT_DIR/$CERT_NAME.crt" ]]; then
            cp "$CERT_DIR/$CERT_NAME.crt" "$backup_dir/"
        fi
        
        if [[ -f "$CERT_DIR/$CERT_NAME.key" ]]; then
            cp "$CERT_DIR/$CERT_NAME.key" "$backup_dir/"
        fi
    fi
}

# Function to generate certificate
generate_certificate() {
    local config_file="$CERT_DIR/openssl.conf"
    
    print_info "Creating OpenSSL configuration file"
    
    # Create OpenSSL config file with IP SAN
    cat > "$config_file" <<EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = IN
ST = Karnataka
L = Bangalore
O = Aria ERP Systems
OU = IT Department
CN = Aria ERP System

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = aria.local
DNS.3 = *.aria.local
IP.1 = 127.0.0.1
IP.2 = $STATIC_IP
EOF

    print_info "Generating RSA private key ($KEY_SIZE bits)"
    openssl genrsa -out "$CERT_DIR/$CERT_NAME.key" $KEY_SIZE
    
    print_info "Generating certificate signing request"
    openssl req -new -key "$CERT_DIR/$CERT_NAME.key" -out "$CERT_DIR/$CERT_NAME.csr" -config "$config_file"
    
    print_info "Generating self-signed certificate (valid for $VALIDITY_DAYS days)"
    openssl x509 -req -days $VALIDITY_DAYS -in "$CERT_DIR/$CERT_NAME.csr" -signkey "$CERT_DIR/$CERT_NAME.key" \
        -out "$CERT_DIR/$CERT_NAME.crt" -extensions v3_req -extfile "$config_file"
    
    # Clean up temporary files
    rm -f "$CERT_DIR/$CERT_NAME.csr" "$config_file"
    
    # Set appropriate permissions
    chmod 600 "$CERT_DIR/$CERT_NAME.key"
    chmod 644 "$CERT_DIR/$CERT_NAME.crt"
}

# Function to display certificate information
display_cert_info() {
    print_info "Certificate Information:"
    openssl x509 -in "$CERT_DIR/$CERT_NAME.crt" -text -noout | grep -A 1 "Subject:"
    openssl x509 -in "$CERT_DIR/$CERT_NAME.crt" -text -noout | grep -A 1 "Not Before:"
    openssl x509 -in "$CERT_DIR/$CERT_NAME.crt" -text -noout | grep -A 1 "Not After:"
    openssl x509 -in "$CERT_DIR/$CERT_NAME.crt" -text -noout | grep -A 10 "Subject Alternative Name:"
}

# Main execution
main() {
    print_info "Aria ERP Certificate Generator"
    print_info "============================="
    
    # Validate input
    if [[ $# -eq 0 ]]; then
        print_warning "No IP address provided. Using default: $STATIC_IP"
    else
        if ! validate_ip "$STATIC_IP"; then
            print_error "Invalid IP address format: $STATIC_IP"
            echo "Usage: $0 <static-ip-address>"
            echo "Example: $0 192.168.1.100"
            exit 1
        fi
    fi
    
    # Check prerequisites
    check_openssl
    
    # Create directory and backup
    create_cert_dir
    backup_existing_certs
    
    # Generate certificate
    generate_certificate
    
    # Display results
    print_success "Certificate generation completed successfully!"
    print_info "Generated certificate files:"
    echo "  Certificate: $CERT_DIR/$CERT_NAME.crt"
    echo "  Private Key: $CERT_DIR/$CERT_NAME.key"
    echo ""
    print_info "Certificate covers the following:"
    echo "  - Static IP: $STATIC_IP"
    echo "  - Localhost: 127.0.0.1"
    echo "  - Domain: *.aria.local"
    echo ""
    display_cert_info
    echo ""
    print_info "Next steps:"
    echo "1. Start your Aria ERP deployment with: ./scripts/deploy-static-ip.sh $STATIC_IP [modules]"
    echo "2. Access your ERP system at: https://$STATIC_IP"
    echo "3. Add certificate exception in browser if prompted"
    echo ""
    print_warning "Note: This is a self-signed certificate. Browsers will show a security warning."
    print_warning "For production environments, consider using a certificate from a trusted CA."
}

# Execute main function
main "$@"