#Requires -Version 5.1
<#
.SYNOPSIS
    Aria ERP - SSL Certificate Generation Script for Windows

.DESCRIPTION
    Generates self-signed SSL certificate with all server IP addresses in SAN
    For path-based routing deployment

.PARAMETER CertPath
    Directory to store certificate files (default: .\volumes\traefik)

.PARAMETER ValidityDays
    Certificate validity in days (default: 365)

.PARAMETER Domain
    Optional domain name to include in certificate

.EXAMPLE
    .\generate-ssl-cert-windows.ps1 -CertPath "C:\Program Files\AriaERP\volumes\traefik"
    
.EXAMPLE
    .\generate-ssl-cert-windows.ps1 -Domain "erp.company.com"
#>

[CmdletBinding()]
param(
    [string]$CertPath = ".\volumes\traefik",
    [int]$ValidityDays = 365,
    [string]$Domain = ""
)

# Color output functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if OpenSSL is available
function Test-OpenSSL {
    $opensslPath = Get-Command openssl -ErrorAction SilentlyContinue
    if (-not $opensslPath) {
        Write-Error "OpenSSL is not installed or not in PATH."
        Write-Info "Download from: https://slproweb.com/products/Win32OpenSSL.html"
        Write-Info "Or install via: winget install -e --id ShiningLight.OpenSSL"
        return $false
    }
    return $true
}

# Detect all IP addresses on this server
function Get-ServerIPAddresses {
    Write-Info "Detecting server IP addresses..."
    
    $ipAddresses = @()
    $ipv6Addresses = @()
    
    # Get all network adapters
    $adapters = Get-NetIPAddress | Where-Object {
        $_.AddressState -eq 'Preferred' -and 
        $_.PrefixOrigin -ne 'WellKnown'
    }
    
    foreach ($adapter in $adapters) {
        if ($adapter.AddressFamily -eq 'IPv4' -and $adapter.IPAddress -ne '127.0.0.1') {
            $ipAddresses += $adapter.IPAddress
        }
        elseif ($adapter.AddressFamily -eq 'IPv6' -and 
                $adapter.IPAddress -notmatch '^fe80' -and 
                $adapter.IPAddress -ne '::1') {
            $ipv6Addresses += $adapter.IPAddress
        }
    }
    
    return @{
        IPv4 = $ipAddresses
        IPv6 = $ipv6Addresses
    }
}

# Main execution
try {
    Write-Info "Aria ERP SSL Certificate Generator"
    Write-Info "===================================="
    
    # Check dependencies
    if (-not (Test-OpenSSL)) {
        exit 1
    }
    
    # Create certificate directory
    if (-not (Test-Path $CertPath)) {
        New-Item -ItemType Directory -Path $CertPath -Force | Out-Null
        Write-Info "Created directory: $CertPath"
    }
    
    # Detect IP addresses
    $addresses = Get-ServerIPAddresses
    
    # Create OpenSSL configuration
    $opensslConf = Join-Path $CertPath "openssl.conf"
    $confContent = @"
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
"@

    # Add detected IPv4 addresses
    $ipIndex = 3
    Write-Info "Adding IP addresses to certificate:"
    foreach ($ip in $addresses.IPv4) {
        $confContent += "`nIP.$ipIndex = $ip"
        Write-Info "  - IPv4: $ip"
        $ipIndex++
    }
    
    # Add detected IPv6 addresses
    $ip6Index = 10
    foreach ($ip6 in $addresses.IPv6) {
        $confContent += "`nIP.$ip6Index = $ip6"
        Write-Info "  - IPv6: $ip6"
        $ip6Index++
    }
    
    # Add domain if provided
    if ($Domain) {
        $confContent += "`nDNS.3 = $Domain"
        Write-Info "  - Domain: $Domain"
    }
    
    # Write configuration file
    $confContent | Out-File -FilePath $opensslConf -Encoding ASCII
    
    # Generate certificate
    Write-Info "Generating certificate and private key..."
    $certFile = Join-Path $CertPath "server.crt"
    $keyFile = Join-Path $CertPath "server.key"
    
    $opensslArgs = @(
        "req", "-new", "-x509", "-nodes",
        "-days", $ValidityDays,
        "-keyout", $keyFile,
        "-out", $certFile,
        "-config", $opensslConf
    )
    
    $result = & openssl $opensslArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to generate certificate"
        Write-Error $result
        exit 1
    }
    
    # Display certificate information
    Write-Info "`nCertificate generated successfully!"
    Write-Info "Certificate details:"
    $certInfo = & openssl x509 -in $certFile -noout -text | Select-String -Pattern "Subject Alternative Name" -Context 0,1
    Write-Host $certInfo
    
    Write-Info "`nCertificate files:"
    Write-Info "  - Certificate: $certFile"
    Write-Info "  - Private Key: $keyFile"
    Write-Info "  - Configuration: $opensslConf"
    
    Write-Info "`nCertificate is valid for $ValidityDays days"
    Write-Info "Certificate includes all detected server IP addresses"
    
    Write-Warn "`nNote: This is a self-signed certificate. Browsers will show a security warning."
    Write-Warn "For production, consider using Let's Encrypt or a commercial CA."
    
    Write-Info "`nAccess your Aria ERP deployment at:"
    foreach ($ip in $addresses.IPv4) {
        Write-Info "  https://$ip/asset/  (or /crm/, /hrms/, /inventory/, /api/)"
    }
    if ($Domain) {
        Write-Info "  https://$Domain/asset/"
    }
    
    exit 0
}
catch {
    Write-Error "An error occurred: $_"
    exit 1
}
