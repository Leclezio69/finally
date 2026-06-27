param([switch]$Stop, [switch]$Build)

$ImageName = "finally"
$ContainerName = "finally"
$Port = 8000
$VolumeName = "finally-data"

if ($Stop) {
    $running = docker ps -q --filter "name=^${ContainerName}$" 2>$null
    if ($running) {
        Write-Host "Stopping FinAlly..."
        docker stop $ContainerName | Out-Null
        docker rm $ContainerName | Out-Null
        Write-Host "FinAlly stopped. Data persists in 'finally-data' Docker volume."
    } else {
        Write-Host "FinAlly is not running."
    }
    exit 0
}

# Check Docker
try {
    docker info | Out-Null
} catch {
    Write-Error "Docker is not running. Please start Docker Desktop and try again."
    exit 1
}

# Check .env
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "Created .env from .env.example. Please add your OPENROUTER_API_KEY."
    } else {
        Write-Error "No .env or .env.example found."
        exit 1
    }
}

# Stop existing container
$existing = docker ps -q --filter "name=^${ContainerName}$" 2>$null
if ($existing) {
    Write-Host "Stopping existing container..."
    docker stop $ContainerName | Out-Null
    docker rm $ContainerName | Out-Null
}

# Build if needed
$imageExists = docker image inspect $ImageName 2>$null
if ($Build -or -not $imageExists) {
    Write-Host "Building FinAlly Docker image..."
    docker build -t $ImageName .
    Write-Host "Build complete."
}

# Run
Write-Host "Starting FinAlly..."
docker run -d `
    --name $ContainerName `
    -v "${VolumeName}:/app/db" `
    -p "${Port}:8000" `
    --env-file .env `
    $ImageName

# Wait for health
Write-Host -NoNewline "Waiting for FinAlly to start"
for ($i = 0; $i -lt 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:${Port}/api/health" -UseBasicParsing -ErrorAction Stop
        Write-Host ""
        Write-Host "FinAlly is running at http://localhost:${Port}"
        Start-Process "http://localhost:${Port}"
        exit 0
    } catch {
        Write-Host -NoNewline "."
        Start-Sleep 1
    }
}
Write-Host ""
Write-Host "Warning: FinAlly may still be starting. Check http://localhost:${Port}"
