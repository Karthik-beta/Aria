<#
.SYNOPSIS
    Runs aria-local.ps1 for Aria ERP Setup without blocking its window.

.DESCRIPTION
    Inno Setup disables the wizard while it waits for a program, so setup
    starts this script without waiting instead. It appends each line the
    script prints to -Log as it arrives (setup reads the file while it grows)
    and writes the exit code to -Done when the script ends.
#>
param(
    [Parameter(Mandatory = $true)][string]$Script,
    [Parameter(Mandatory = $true)][string]$Log,
    [Parameter(Mandatory = $true)][string]$Done,
    # aria-local.ps1 arguments, space-separated
    [string]$Arguments = ''
)

# Setup may be reading the log at the moment a line is written, so retry briefly.
function Add-Line([string]$Line) {
    for ($attempt = 0; $attempt -lt 50; $attempt++) {
        try {
            [System.IO.File]::AppendAllText($Log, "$Line`r`n", [System.Text.Encoding]::Default)
            return
        }
        catch {
            Start-Sleep -Milliseconds 20
        }
    }
}

$code = 1
try {
    $scriptArgs = @('-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $Script) +
        @($Arguments -split ' ' | Where-Object { $_ -ne '' })
    & "$PSHOME\powershell.exe" @scriptArgs 2>&1 | ForEach-Object { Add-Line "$_" }
    $code = $LASTEXITCODE
}
catch {
    Add-Line "[ERROR] $_"
}
finally {
    Set-Content -Path $Done -Value $code -Encoding ascii
}
