# Performance Testing Script for Bazar.com
# Tests response times with and without caching

Write-Host "=== Bazar.com Performance Testing ===" -ForegroundColor Cyan
Write-Host ""

# Test Configuration
$baseUrl = "http://localhost:3002"
$iterations = 20
$testBookId = "1"
$testTopic = "distributed systems"

# Results storage
$results = @{
    searchWithCache = @()
    searchWithoutCache = @()
    infoWithCache = @()
    infoWithoutCache = @()
    purchaseTime = @()
    cacheInvalidationTime = @()
}

# Helper function to measure request time
function Measure-Request {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null
    )
    
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    try {
        if ($Method -eq "GET") {
            $response = Invoke-RestMethod -Uri $Url -ErrorAction Stop
        } else {
            if ($Body) {
                $response = Invoke-RestMethod -Uri $Url -Method $Method -Body ($Body | ConvertTo-Json) -ContentType "application/json" -ErrorAction Stop
            } else {
                $response = Invoke-RestMethod -Uri $Url -Method $Method -ErrorAction Stop
            }
        }
        $stopwatch.Stop()
        return @{
            Success = $true
            Time = $stopwatch.ElapsedMilliseconds
            Response = $response
        }
    } catch {
        $stopwatch.Stop()
        return @{
            Success = $false
            Time = $stopwatch.ElapsedMilliseconds
            Error = $_.Exception.Message
        }
    }
}

# Test 1: Search Performance (Without Cache)
Write-Host "[Test 1] Measuring Search Performance WITHOUT Cache..." -ForegroundColor Yellow
Write-Host "Clearing cache first..."
Invoke-RestMethod -Uri "$baseUrl/invalidate-cache" -Method POST -Body (@{bookId = "*"} | ConvertTo-Json) -ContentType "application/json" -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

for ($i = 1; $i -le $iterations; $i++) {
    # Clear cache before each request
    Invoke-RestMethod -Uri "$baseUrl/invalidate-cache" -Method POST -Body (@{bookId = $testBookId} | ConvertTo-Json) -ContentType "application/json" -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 100
    
    $result = Measure-Request -Url "$baseUrl/search/$testTopic"
    if ($result.Success) {
        $results.searchWithoutCache += $result.Time
        Write-Host "  Request $i : $($result.Time)ms (MISS)" -ForegroundColor Red
    }
}

Write-Host ""

# Test 2: Search Performance (With Cache)
Write-Host "[Test 2] Measuring Search Performance WITH Cache..." -ForegroundColor Yellow

# Prime the cache
Invoke-RestMethod -Uri "$baseUrl/search/$testTopic" -ErrorAction SilentlyContinue | Out-Null

for ($i = 1; $i -le $iterations; $i++) {
    $result = Measure-Request -Url "$baseUrl/search/$testTopic"
    if ($result.Success) {
        $results.searchWithCache += $result.Time
        Write-Host "  Request $i : $($result.Time)ms (HIT)" -ForegroundColor Green
    }
}

Write-Host ""

# Test 3: Info Performance (Without Cache)
Write-Host "[Test 3] Measuring Info Performance WITHOUT Cache..." -ForegroundColor Yellow

for ($i = 1; $i -le $iterations; $i++) {
    # Clear cache before each request
    Invoke-RestMethod -Uri "$baseUrl/invalidate-cache" -Method POST -Body (@{bookId = $testBookId} | ConvertTo-Json) -ContentType "application/json" -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 100
    
    $result = Measure-Request -Url "$baseUrl/info/$testBookId"
    if ($result.Success) {
        $results.infoWithoutCache += $result.Time
        Write-Host "  Request $i : $($result.Time)ms (MISS)" -ForegroundColor Red
    }
}

Write-Host ""

# Test 4: Info Performance (With Cache)
Write-Host "[Test 4] Measuring Info Performance WITH Cache..." -ForegroundColor Yellow

# Prime the cache
Invoke-RestMethod -Uri "$baseUrl/info/$testBookId" -ErrorAction SilentlyContinue | Out-Null

for ($i = 1; $i -le $iterations; $i++) {
    $result = Measure-Request -Url "$baseUrl/info/$testBookId"
    if ($result.Success) {
        $results.infoWithCache += $result.Time
        Write-Host "  Request $i : $($result.Time)ms (HIT)" -ForegroundColor Green
    }
}

Write-Host ""

# Test 5: Purchase Performance & Cache Invalidation
Write-Host "[Test 5] Measuring Purchase + Cache Invalidation Overhead..." -ForegroundColor Yellow

for ($i = 1; $i -le 10; $i++) {
    # Use different books to avoid stock issues
    $bookToTest = ($i % 7) + 1
    
    # Prime cache
    Invoke-RestMethod -Uri "$baseUrl/info/$bookToTest" -ErrorAction SilentlyContinue | Out-Null
    
    # Measure purchase (includes cache invalidation)
    $result = Measure-Request -Url "$baseUrl/purchase/$bookToTest" -Method "POST"
    if ($result.Success) {
        $results.purchaseTime += $result.Time
        Write-Host "  Purchase $i (Book $bookToTest): $($result.Time)ms" -ForegroundColor Cyan
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host ""

# Test 6: Cache Miss Latency After Invalidation
Write-Host "[Test 6] Measuring Cache Miss Latency After Invalidation..." -ForegroundColor Yellow

for ($i = 1; $i -le 10; $i++) {
    # Prime cache
    Invoke-RestMethod -Uri "$baseUrl/info/$testBookId" -ErrorAction SilentlyContinue | Out-Null
    
    # Invalidate
    $invalidateStart = [System.Diagnostics.Stopwatch]::StartNew()
    Invoke-RestMethod -Uri "$baseUrl/invalidate-cache" -Method POST -Body (@{bookId = $testBookId} | ConvertTo-Json) -ContentType "application/json" -ErrorAction SilentlyContinue
    $invalidateStart.Stop()
    $results.cacheInvalidationTime += $invalidateStart.ElapsedMilliseconds
    
    # Measure next request (should be cache miss)
    $result = Measure-Request -Url "$baseUrl/info/$testBookId"
    Write-Host "  Test $i - Invalidation: $($invalidateStart.ElapsedMilliseconds)ms, Next Request: $($result.Time)ms" -ForegroundColor Magenta
    
    Start-Sleep -Milliseconds 200
}

Write-Host ""
Write-Host "=== Performance Test Results ===" -ForegroundColor Cyan
Write-Host ""

# Calculate statistics
function Get-Stats {
    param([array]$data)
    
    if ($data.Count -eq 0) {
        return @{ Avg = 0; Min = 0; Max = 0; Median = 0 }
    }
    
    $sorted = $data | Sort-Object
    $median = if ($sorted.Count % 2 -eq 0) {
        ($sorted[$sorted.Count/2 - 1] + $sorted[$sorted.Count/2]) / 2
    } else {
        $sorted[[Math]::Floor($sorted.Count/2)]
    }
    
    return @{
        Avg = [Math]::Round(($data | Measure-Object -Average).Average, 2)
        Min = ($data | Measure-Object -Minimum).Minimum
        Max = ($data | Measure-Object -Maximum).Maximum
        Median = [Math]::Round($median, 2)
    }
}

$searchWithoutCacheStats = Get-Stats -data $results.searchWithoutCache
$searchWithCacheStats = Get-Stats -data $results.searchWithCache
$infoWithoutCacheStats = Get-Stats -data $results.infoWithoutCache
$infoWithCacheStats = Get-Stats -data $results.infoWithCache
$purchaseStats = Get-Stats -data $results.purchaseTime
$invalidationStats = Get-Stats -data $results.cacheInvalidationTime

Write-Host "Search Requests (without cache):" -ForegroundColor Yellow
Write-Host "  Average: $($searchWithoutCacheStats.Avg)ms"
Write-Host "  Median:  $($searchWithoutCacheStats.Median)ms"
Write-Host "  Min:     $($searchWithoutCacheStats.Min)ms"
Write-Host "  Max:     $($searchWithoutCacheStats.Max)ms"
Write-Host ""

Write-Host "Search Requests (with cache):" -ForegroundColor Green
Write-Host "  Average: $($searchWithCacheStats.Avg)ms"
Write-Host "  Median:  $($searchWithCacheStats.Median)ms"
Write-Host "  Min:     $($searchWithCacheStats.Min)ms"
Write-Host "  Max:     $($searchWithCacheStats.Max)ms"
Write-Host ""

$searchImprovement = [Math]::Round((($searchWithoutCacheStats.Avg - $searchWithCacheStats.Avg) / $searchWithoutCacheStats.Avg) * 100, 2)
Write-Host "Search Cache Improvement: $searchImprovement%" -ForegroundColor Cyan
Write-Host ""

Write-Host "Info Requests (without cache):" -ForegroundColor Yellow
Write-Host "  Average: $($infoWithoutCacheStats.Avg)ms"
Write-Host "  Median:  $($infoWithoutCacheStats.Median)ms"
Write-Host "  Min:     $($infoWithoutCacheStats.Min)ms"
Write-Host "  Max:     $($infoWithoutCacheStats.Max)ms"
Write-Host ""

Write-Host "Info Requests (with cache):" -ForegroundColor Green
Write-Host "  Average: $($infoWithCacheStats.Avg)ms"
Write-Host "  Median:  $($infoWithCacheStats.Median)ms"
Write-Host "  Min:     $($infoWithCacheStats.Min)ms"
Write-Host "  Max:     $($infoWithCacheStats.Max)ms"
Write-Host ""

$infoImprovement = [Math]::Round((($infoWithoutCacheStats.Avg - $infoWithCacheStats.Avg) / $infoWithoutCacheStats.Avg) * 100, 2)
Write-Host "Info Cache Improvement: $infoImprovement%" -ForegroundColor Cyan
Write-Host ""

Write-Host "Purchase Operations:" -ForegroundColor Cyan
Write-Host "  Average: $($purchaseStats.Avg)ms"
Write-Host "  Median:  $($purchaseStats.Median)ms"
Write-Host "  Min:     $($purchaseStats.Min)ms"
Write-Host "  Max:     $($purchaseStats.Max)ms"
Write-Host ""

Write-Host "Cache Invalidation:" -ForegroundColor Magenta
Write-Host "  Average: $($invalidationStats.Avg)ms"
Write-Host "  Median:  $($invalidationStats.Median)ms"
Write-Host "  Min:     $($invalidationStats.Min)ms"
Write-Host "  Max:     $($invalidationStats.Max)ms"
Write-Host ""

# Export results to CSV
$csvData = @()
$csvData += [PSCustomObject]@{
    Test = "Search (No Cache)"
    AvgMs = $searchWithoutCacheStats.Avg
    MedianMs = $searchWithoutCacheStats.Median
    MinMs = $searchWithoutCacheStats.Min
    MaxMs = $searchWithoutCacheStats.Max
}
$csvData += [PSCustomObject]@{
    Test = "Search (With Cache)"
    AvgMs = $searchWithCacheStats.Avg
    MedianMs = $searchWithCacheStats.Median
    MinMs = $searchWithCacheStats.Min
    MaxMs = $searchWithCacheStats.Max
}
$csvData += [PSCustomObject]@{
    Test = "Info (No Cache)"
    AvgMs = $infoWithoutCacheStats.Avg
    MedianMs = $infoWithoutCacheStats.Median
    MinMs = $infoWithoutCacheStats.Min
    MaxMs = $infoWithoutCacheStats.Max
}
$csvData += [PSCustomObject]@{
    Test = "Info (With Cache)"
    AvgMs = $infoWithCacheStats.Avg
    MedianMs = $infoWithCacheStats.Median
    MinMs = $infoWithCacheStats.Min
    MaxMs = $infoWithCacheStats.Max
}
$csvData += [PSCustomObject]@{
    Test = "Purchase"
    AvgMs = $purchaseStats.Avg
    MedianMs = $purchaseStats.Median
    MinMs = $purchaseStats.Min
    MaxMs = $purchaseStats.Max
}
$csvData += [PSCustomObject]@{
    Test = "Cache Invalidation"
    AvgMs = $invalidationStats.Avg
    MedianMs = $invalidationStats.Median
    MinMs = $invalidationStats.Min
    MaxMs = $invalidationStats.Max
}

$csvPath = "docs\performance-results.csv"
$csvData | Export-Csv -Path $csvPath -NoTypeInformation
Write-Host "Results exported to: $csvPath" -ForegroundColor Green
Write-Host ""

Write-Host "=== Test Complete ===" -ForegroundColor Cyan
