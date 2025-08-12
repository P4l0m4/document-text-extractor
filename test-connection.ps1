try {
    Write-Host "Testing connection to localhost:3000..."
    $response = Invoke-WebRequest -Uri "http://localhost:3000/" -Method GET -TimeoutSec 5
    Write-Host "✅ Connection successful!"
    Write-Host "Status Code: $($response.StatusCode)"
    Write-Host "Content: $($response.Content.Substring(0, [Math]::Min(200, $response.Content.Length)))"
} catch {
    Write-Host "❌ Connection failed: $($_.Exception.Message)"
    
    # Try to check if port is listening
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet
        if ($connection) {
            Write-Host "Port 3000 is listening, but HTTP request failed"
        } else {
            Write-Host "Port 3000 is not listening"
        }
    } catch {
        Write-Host "Could not test port connectivity"
    }
}