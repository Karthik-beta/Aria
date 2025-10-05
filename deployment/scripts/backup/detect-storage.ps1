# Aria ERP - Storage Detection Script (Windows)
# Detects available backup storage locations in priority order:
# 1. External USB/storage devices
# 2. Network storage (mapped drives)
# 3. Local storage (fallback)

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Minimum free space required (in GB)
$MinFreeSpaceGB = 5

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $color = switch ($Level) {
        "INFO"  { "Green" }
        "WARN"  { "Yellow" }
        "ERROR" { "Red" }
        default { "White" }
    }
    
    Write-Host "[$Level] " -ForegroundColor $color -NoNewline
    Write-Host $Message
}

function Test-FreeSpace {
    param(
        [string]$Path
    )
    
    try {
        if (Test-Path $Path) {
            $drive = Split-Path -Path $Path -Qualifier
            if (-not $drive) {
                $drive = (Get-Item $Path).PSDrive.Name + ":"
            }
            
            $driveInfo = Get-PSDrive -Name $drive.TrimEnd(':') -ErrorAction SilentlyContinue
            if ($driveInfo) {
                $freeGB = [math]::Round($driveInfo.Free / 1GB, 2)
                return $freeGB -ge $MinFreeSpaceGB
            }
        }
    }
    catch {
        return $false
    }
    
    return $false
}

function Find-ExternalStorage {
    Write-ColorOutput "Checking for external storage devices..." -Level "INFO"
    
    try {
        # Get all removable drives
        $removableDrives = Get-WmiObject -Class Win32_LogicalDisk |
            Where-Object { $_.DriveType -eq 2 -and $_.FreeSpace -ne $null }
        
        foreach ($drive in $removableDrives) {
            $driveLetter = $drive.DeviceID
            if (Test-FreeSpace $driveLetter) {
                return "external:$driveLetter\AriaBackups"
            }
        }
        
        # Check for external USB drives (DriveType 3 but removable)
        $usbDrives = Get-WmiObject -Class Win32_DiskDrive |
            Where-Object { $_.InterfaceType -eq "USB" } |
            ForEach-Object {
                $disk = $_
                Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskDrive.DeviceID='$($disk.DeviceID)'} WHERE AssocClass=Win32_DiskDriveToDiskPartition" |
                ForEach-Object {
                    Get-WmiObject -Query "ASSOCIATORS OF {Win32_DiskPartition.DeviceID='$($_.DeviceID)'} WHERE AssocClass=Win32_LogicalDiskToPartition" |
                    Select-Object -ExpandProperty DeviceID
                }
            }
        
        foreach ($drive in $usbDrives) {
            if (Test-FreeSpace $drive) {
                return "external:$drive\AriaBackups"
            }
        }
    }
    catch {
        if ($Verbose) {
            Write-ColorOutput "Error checking external storage: $($_.Exception.Message)" -Level "WARN"
        }
    }
    
    return $null
}

function Find-NetworkStorage {
    Write-ColorOutput "Checking for network storage..." -Level "INFO"
    
    try {
        # Get all mapped network drives
        $networkDrives = Get-PSDrive -PSProvider FileSystem |
            Where-Object { $_.DisplayRoot -like "\\*" }
        
        foreach ($drive in $networkDrives) {
            $drivePath = "$($drive.Name):\AriaBackups"
            if (Test-FreeSpace "$($drive.Name):") {
                return "network:$drivePath"
            }
        }
        
        # Check for UNC paths
        $commonNetworkPaths = @(
            "\\nas\backups",
            "\\backup\aria",
            "\\fileserver\backups"
        )
        
        foreach ($path in $commonNetworkPaths) {
            if ((Test-Path $path -ErrorAction SilentlyContinue) -and (Test-FreeSpace $path)) {
                return "network:$path\AriaBackups"
            }
        }
    }
    catch {
        if ($Verbose) {
            Write-ColorOutput "Error checking network storage: $($_.Exception.Message)" -Level "WARN"
        }
    }
    
    return $null
}

function Find-LocalStorage {
    Write-ColorOutput "Using local storage as fallback..." -Level "INFO"
    
    # Try user's Documents folder first (most reliable)
    try {
        $documents = [Environment]::GetFolderPath("MyDocuments")
        $backupPath = Join-Path $documents "AriaERP\backups"
        
        if (-not (Test-Path $backupPath)) {
            New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
        }
        
        if (Test-FreeSpace $backupPath) {
            return "local:$backupPath"
        }
    }
    catch {
        if ($Verbose) {
            Write-ColorOutput "Could not use Documents folder: $($_.Exception.Message)" -Level "WARN"
        }
    }
    
    # Try Program Files (requires admin)
    try {
        $programFiles = "C:\Program Files\AriaERP\backups"
        
        # Create directory if it doesn't exist
        if (-not (Test-Path $programFiles)) {
            New-Item -ItemType Directory -Path $programFiles -Force | Out-Null
        }
        
        if (Test-FreeSpace $programFiles) {
            return "local:$programFiles"
        }
    }
    catch {
        if ($Verbose) {
            Write-ColorOutput "Could not use Program Files: $($_.Exception.Message)" -Level "WARN"
        }
    }
    
    # Try temp folder as absolute last resort
    try {
        $temp = $env:TEMP
        $backupPath = Join-Path $temp "AriaERP\backups"
        
        if (-not (Test-Path $backupPath)) {
            New-Item -ItemType Directory -Path $backupPath -Force | Out-Null
        }
        
        if (Test-FreeSpace $backupPath) {
            Write-ColorOutput "WARNING: Using temp folder - backups may be cleaned automatically" -Level "WARN"
            return "local:$backupPath"
        }
    }
    catch {
        Write-ColorOutput "Error setting up local storage: $($_.Exception.Message)" -Level "ERROR"
    }
    
    return $null
}

# Main execution
function Main {
    Write-Host "=== Aria ERP Storage Detection ===" -ForegroundColor Cyan
    Write-Host ""
    
    # Try external storage first
    $result = Find-ExternalStorage
    if ($result) {
        Write-ColorOutput "✓ External storage detected: $($result -replace '^external:', '')" -Level "INFO"
        Write-Output $result
        exit 0
    }
    
    # Try network storage
    $result = Find-NetworkStorage
    if ($result) {
        Write-ColorOutput "✓ Network storage detected: $($result -replace '^network:', '')" -Level "INFO"
        Write-Output $result
        exit 0
    }
    
    # Fallback to local storage
    $result = Find-LocalStorage
    if ($result) {
        Write-ColorOutput "Using local storage: $($result -replace '^local:', '')" -Level "WARN"
        Write-Output $result
        exit 0
    }
    
    # No suitable storage found
    Write-ColorOutput "No suitable backup storage found" -Level "ERROR"
    Write-ColorOutput "Please ensure at least ${MinFreeSpaceGB}GB of free space is available" -Level "ERROR"
    exit 1
}

Main
