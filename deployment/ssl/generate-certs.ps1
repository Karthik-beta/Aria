# SSL Certificate Generation Script for Windows
# Generates self-signed SSL certificates for all available IP addresses
# Suitable for private network deployments

param(
    [string]$CertDir = "C:\certs",
    [int]$Days = 365,
    [int]$KeySize = 2048,
    [string]$Domain = "localhost",
    [string]$Country = "US",
    [string]$State = "State",
    [string]$Locality = "City",
    [string]$Organization = "Aria ERP",
    [string]$OrgUnit = "IT Department"
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Logging functions
function Write-InfoLog {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-WarnLog {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-ErrorLog {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to get all IP addresses
function Get-IPAddresses {
    Write-InfoLog "Detecting IP addresses..."
    
    try {
        $adapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
            $_.IPAddress -ne "127.0.0.1" -and
            $_.PrefixOrigin -ne "WellKnown" -and
            $_.AddressState -eq "Preferred"
        }
        
        $ips = $adapters | Select-Object -ExpandProperty IPAddress
        
        if ($ips.Count -eq 0) {
            Write-WarnLog "No IP addresses detected, using localhost"
            return @("127.0.0.1")
        }
        
        return $ips
    }
    catch {
        Write-WarnLog "Error detecting IP addresses: $_"
        return @("127.0.0.1")
    }
}

# Function to generate OpenSSL configuration
function New-OpenSSLConfig {
    param(
        [string]$ConfigPath,
        [array]$IPAddresses
    )
    
    Write-InfoLog "Creating OpenSSL configuration..."
    
    # Build SAN entries
    $sanDns = @"
DNS.1 = $Domain
DNS.2 = *.$Domain
DNS.3 = localhost
"@
    
    $sanIps = ""
    $counter = 1
    foreach ($ip in $IPAddresses) {
        $sanIps += "IP.$counter = $ip`n"
        $counter++
    }
    $sanIps += "IP.$counter = 127.0.0.1"
    
    $configContent = @"
[req]
default_bits = $KeySize
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req
x509_extensions = v3_ca

[dn]
C=$Country
ST=$State
L=$Locality
O=$Organization
OU=$OrgUnit
CN=$Domain

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
$sanDns
$sanIps
"@
    
    Set-Content -Path $ConfigPath -Value $configContent -Encoding UTF8
}

# Main function
function Main {
    Write-InfoLog "Starting SSL certificate generation..."
    Write-InfoLog "Configuration:"
    Write-InfoLog "  Domain: $Domain"
    Write-InfoLog "  Certificate directory: $CertDir"
    Write-InfoLog "  Validity period: $Days days"
    Write-InfoLog "  Key size: $KeySize bits"
    Write-Host ""
    
    # Check if OpenSSL is installed
    $opensslPath = Get-Command openssl -ErrorAction SilentlyContinue
    if (-not $opensslPath) {
        Write-ErrorLog "OpenSSL is not installed or not in PATH."
        Write-InfoLog "Please install OpenSSL from https://slproweb.com/products/Win32OpenSSL.html"
        exit 1
    }
    
    # Create certificate directory
    Write-InfoLog "Creating certificate directory: $CertDir"
    if (-not (Test-Path $CertDir)) {
        New-Item -ItemType Directory -Path $CertDir -Force | Out-Null
    }
    
    # Get IP addresses
    $ipAddresses = Get-IPAddresses
    Write-InfoLog "Detected IP addresses:"
    foreach ($ip in $ipAddresses) {
        Write-InfoLog "  - $ip"
    }
    
    # Generate OpenSSL configuration
    $configPath = Join-Path $CertDir "openssl.conf"
    New-OpenSSLConfig -ConfigPath $configPath -IPAddresses $ipAddresses
    
    # Generate private key
    Write-InfoLog "Generating private key..."
    $keyPath = Join-Path $CertDir "server.key"
    & openssl genrsa -out $keyPath $KeySize 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorLog "Failed to generate private key"
        exit 1
    }
    
    # Generate certificate
    Write-InfoLog "Generating certificate..."
    $certPath = Join-Path $CertDir "server.crt"
    & openssl req -new -x509 `
        -key $keyPath `
        -out $certPath `
        -days $Days `
        -config $configPath `
        -extensions v3_req 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorLog "Failed to generate certificate"
        exit 1
    }
    
    # Set file permissions (Windows ACL)
    try {
        $acl = Get-Acl $keyPath
        $acl.SetAccessRuleProtection($true, $false)
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
            [System.Security.Principal.WindowsIdentity]::GetCurrent().Name,
            "FullControl",
            "Allow"
        )
        $acl.SetAccessRule($rule)
        Set-Acl $keyPath $acl
    }
    catch {
        Write-WarnLog "Could not set restrictive permissions on private key: $_"
    }
    
    Write-InfoLog ""
    Write-Host "✓ SSL certificates generated successfully!" -ForegroundColor Green
    Write-InfoLog ""
    Write-InfoLog "Certificate details:"
    Write-InfoLog "  Certificate: $certPath"
    Write-InfoLog "  Private Key: $keyPath"
    Write-InfoLog "  Valid for: $Days days"
    Write-InfoLog "  Algorithm: RSA $KeySize bits"
    Write-InfoLog ""
    
    # Display certificate information
    Write-InfoLog "Certificate information:"
    & openssl x509 -in $certPath -noout -subject -issuer -dates 2>&1
    Write-InfoLog ""
    Write-InfoLog "Subject Alternative Names:"
    & openssl x509 -in $certPath -noout -text 2>&1 | Select-String -Pattern "Subject Alternative Name" -Context 0,1
    
    Write-Host ""
    Write-Host "✓ Certificate generation completed!" -ForegroundColor Green
}

# Run main function
try {
    Main
}
catch {
    Write-ErrorLog "An error occurred: $_"
    Write-ErrorLog $_.ScriptStackTrace
    exit 1
}
