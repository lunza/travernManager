# TravenManager project starter

# Change to script directory
Set-Location -Path "$PSScriptRoot"

Write-Host "************************************"
Write-Host "TravenManager project starter"
Write-Host "************************************"
Write-Host ""

# Check Node.js installation
Write-Host "Checking Node.js environment..."
try {
    $nodeVersion = node --version
    Write-Host "Node.js installed: $nodeVersion"
} catch {
    Write-Host "Error: Node.js not found, please install Node.js first" -ForegroundColor Red
    Write-Host "Please visit https://nodejs.org/ to download and install" -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    exit 1
}

# Check npm availability
Write-Host "Checking npm environment..."
try {
    $npmVersion = npm --version
    Write-Host "npm available: $npmVersion"
} catch {
    Write-Host "Error: npm not available" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

# Check dependencies
if (-not (Test-Path "node_modules")) {
    Write-Host "Dependencies not found, installing..."
    try {
        npm install
        Write-Host "Dependencies installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit..."
        exit 1
    }
}

# Start development server
Write-Host "Starting development server..."
try {
    npm run dev
} catch {
    Write-Host "Failed to start server" -ForegroundColor Red
    Read-Host "Press Enter to exit..."
    exit 1
}

Read-Host "Press Enter to exit..."
