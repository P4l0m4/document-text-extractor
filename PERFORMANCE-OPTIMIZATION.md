# Scanned PDF Processing Performance Optimization

This document describes the comprehensive performance optimization system implemented for scanned PDF processing in the document processing API.

## Overview

The performance optimization system consists of four main components:

1. **Performance Monitor Service** - Real-time monitoring and alerting
2. **Optimized Temp File Service** - Efficient temporary file management
3. **Memory Optimizer Service** - Memory usage optimization and garbage collection
4. **Metrics Dashboard Service** - Comprehensive metrics collection and reporting

## Components

### 1. Performance Monitor Service

**Purpose**: Real-time monitoring of system performance with configurable alerting thresholds.

**Key Features**:
- Memory usage monitoring with automatic snapshots
- Processing time tracking with percentile calculations
- Temporary file operation monitoring
- Configurable alert thresholds for warning and critical levels
- Comprehensive performance dashboard data

**Configuration**:
```bash
# Memory thresholds
PERF_MEMORY_WARNING_MB=512
PERF_MEMORY_CRITICAL_MB=1024

# Processing time thresholds
PERF_PROCESSING_WARNING_MS=15000
PERF_PROCESSING_CRITICAL_MS=30000

# Temp file thresholds
PERF_TEMP_FILES_WARNING=50
PERF_TEMP_FILES_CRITICAL=100

# Error rate thresholds
PERF_ERROR_RATE_WARNING=10
PERF_ERROR_RATE_CRITICAL=25

# Monitoring intervals
PERF_MEMORY_CHECK_INTERVAL_MS=30000
```

**Usage Example**:
```typescript
// Record processing time
performanceMonitor.recordProcessingTime(sessionId, duration);

// Record temp file operations
performanceMonitor.recordTempFileOperation('create', 1, filePath);

// Get performance dashboard
const dashboard = performanceMonitor.getPerformanceDashboard();

// Get recent alerts
const alerts = performanceMonitor.getRecentAlerts(10);
```

### 2. Optimized Temp File Service

**Purpose**: Efficient management of temporary files with automatic cleanup and resource limits.

**Key Features**:
- Conflict-free temporary file naming
- Automatic cleanup based on age and size limits
- Session-based file tracking and cleanup
- Batch cleanup operations for better performance
- Resource usage monitoring and alerts

**Configuration**:
```bash
# File limits
TEMP_FILE_MAX_COUNT=100
TEMP_FILE_MAX_AGE_MS=3600000  # 1 hour
TEMP_FILE_MAX_SIZE_MB=500     # 500MB total

# Cleanup settings
TEMP_FILE_CLEANUP_INTERVAL_MS=300000  # 5 minutes
TEMP_FILE_BATCH_CLEANUP_SIZE=10

# Directory
TEMP_DIR=/tmp/document-processing
```

**Usage Example**:
```typescript
// Create temp file path
const tempPath = tempFileService.createTempFilePath('.png', sessionId);

// Register temp file for tracking
const fileId = await tempFileService.registerTempFile(tempPath, 'image', sessionId);

// Schedule cleanup
tempFileService.scheduleCleanup(fileId, 300000); // 5 minutes

// Cleanup by session
const cleanedCount = await tempFileService.cleanupBySession(sessionId);
```

### 3. Memory Optimizer Service

**Purpose**: Proactive memory management with garbage collection and buffer optimization.

**Key Features**:
- Automatic garbage collection based on thresholds
- Memory pressure detection and optimization
- Optimized buffer pool for image processing
- Pre-allocation of common buffer sizes
- Memory usage recommendations

**Configuration**:
```bash
# Garbage collection
MEMORY_ENABLE_GC=true
MEMORY_GC_THRESHOLD_MB=256
MEMORY_GC_INTERVAL_MS=60000

# Memory pressure detection
MEMORY_ENABLE_PRESSURE_DETECTION=true
MEMORY_PRESSURE_THRESHOLD_MB=512

# Buffer optimization
MEMORY_ENABLE_BUFFER_OPTIMIZATION=true
MEMORY_MAX_BUFFER_SIZE_MB=50
```

**Usage Example**:
```typescript
// Pre-optimize for PDF conversion
const result = await memoryOptimizer.optimizeForPdfConversion(sessionId);

// Get optimized buffer
const buffer = memoryOptimizer.getOptimizedBuffer(size, key);

// Release buffer
memoryOptimizer.releaseBuffer(key);

// Post-processing cleanup
await memoryOptimizer.optimizeAfterPdfConversion(sessionId);
```

### 4. Metrics Dashboard Service

**Purpose**: Comprehensive metrics collection and dashboard for monitoring system health.

**Key Features**:
- Real-time dashboard with historical trends
- Metrics export for external monitoring systems
- System health assessment
- Performance recommendations
- Comprehensive reporting

**Dashboard Data Includes**:
- Processing overview (attempts, success rate, average time)
- Memory usage statistics and optimization metrics
- Processing time percentiles and slowest sessions
- Alert summary and recent alerts
- Scanned PDF processing statistics
- Resource usage and system health
- Hourly trends and method breakdown

**Usage Example**:
```typescript
// Get current dashboard
const dashboard = dashboardService.getCurrentDashboard();

// Get dashboard with history
const dashboardWithHistory = dashboardService.getDashboardWithHistory();

// Export metrics for external monitoring
const metrics = dashboardService.exportMetrics();

// Get performance summary
const summary = dashboardService.getPerformanceSummary();
```

## Performance Optimizations

### Memory Usage Optimization

1. **Garbage Collection Management**:
   - Automatic GC triggering based on heap usage thresholds
   - Periodic GC scheduling to prevent memory buildup
   - Multiple GC cycles for thorough cleanup during optimization

2. **Buffer Pool Optimization**:
   - Reusable buffer pool for image processing
   - Pre-allocated common buffer sizes
   - Automatic buffer clearing and sensitive data cleanup

3. **Memory Pressure Detection**:
   - Real-time RSS and heap monitoring
   - Automatic optimization when pressure detected
   - Configurable pressure thresholds

### Temporary File I/O Optimization

1. **Efficient File Management**:
   - Conflict-free naming with timestamps and random components
   - Session-based tracking for bulk operations
   - Automatic cleanup based on age and size limits

2. **Batch Operations**:
   - Batch cleanup to reduce I/O overhead
   - Configurable batch sizes for optimal performance
   - Parallel cleanup operations where safe

3. **Resource Monitoring**:
   - Real-time tracking of file count and total size
   - Automatic cleanup when limits exceeded
   - Directory size calculation for accurate monitoring

### Processing Time Monitoring

1. **Real-time Tracking**:
   - Per-session processing time recording
   - Percentile calculations (median, 95th, 99th)
   - Slowest session identification

2. **Alert System**:
   - Configurable warning and critical thresholds
   - Session-specific alert context
   - Historical alert tracking

3. **Performance Analytics**:
   - Processing method breakdown
   - Success rate trends
   - Performance recommendations

## Integration with AI Model Pool Service

The performance optimization services are integrated into the AI Model Pool Service to provide:

1. **Pre-processing Optimization**:
   - Memory optimization before PDF conversion
   - Buffer pre-allocation for image processing
   - Temp file path generation with session tracking

2. **During Processing**:
   - Real-time performance monitoring
   - Memory usage tracking
   - Temp file registration and management

3. **Post-processing Cleanup**:
   - Session-based temp file cleanup
   - Memory optimization after conversion
   - Performance metrics recording

## Monitoring and Alerting

### Alert Types

1. **Memory Alerts**:
   - Warning: Heap usage > 512MB
   - Critical: Heap usage > 1024MB

2. **Processing Time Alerts**:
   - Warning: Processing time > 15 seconds
   - Critical: Processing time > 30 seconds

3. **Temp File Alerts**:
   - Warning: File count > 50
   - Critical: File count > 100

4. **Error Rate Alerts**:
   - Warning: Error rate > 10%
   - Critical: Error rate > 25%

### System Health Assessment

The system continuously assesses health based on:
- Memory pressure indicators
- Temp file utilization
- Processing backlog
- Error rates

Health status: `healthy` | `warning` | `critical`

## Performance Benchmarks

### Target Performance Metrics

1. **Memory Optimization**: < 1 second
2. **Temp File Operations**: < 100ms per operation
3. **Metrics Collection**: < 500ms for dashboard
4. **Alert Processing**: < 50ms

### Resource Limits

1. **Memory**:
   - Max heap usage: 1GB
   - Buffer pool limit: 10 buffers
   - GC threshold: 256MB

2. **Temp Files**:
   - Max file count: 100
   - Max total size: 500MB
   - Max file age: 1 hour

3. **Processing**:
   - Warning threshold: 15 seconds
   - Critical threshold: 30 seconds
   - Concurrent PDF conversions: 5

## Usage in Production

### Environment Variables

Set the following environment variables for optimal performance:

```bash
# Enable performance optimizations
MEMORY_ENABLE_GC=true
MEMORY_ENABLE_PRESSURE_DETECTION=true
MEMORY_ENABLE_BUFFER_OPTIMIZATION=true

# Set appropriate thresholds based on your system
PERF_MEMORY_WARNING_MB=512
PERF_MEMORY_CRITICAL_MB=1024
PERF_PROCESSING_WARNING_MS=15000
PERF_PROCESSING_CRITICAL_MS=30000

# Configure temp file management
TEMP_FILE_MAX_COUNT=100
TEMP_FILE_MAX_SIZE_MB=500
TEMP_FILE_CLEANUP_INTERVAL_MS=300000

# Enable Node.js garbage collection
NODE_OPTIONS="--expose-gc"
```

### Monitoring Integration

The metrics can be exported to external monitoring systems:

```typescript
// Export metrics in Prometheus format
const metrics = dashboardService.exportMetrics();

// Metrics include:
// - processing_attempts_total
// - processing_success_rate
// - memory_heap_used_mb
// - temp_files_current
// - alerts_critical
// - error_rate_percent
```

### Logging

All services provide comprehensive logging:

```typescript
// Enable detailed logging
performanceMonitor.logPerformanceSummary();
tempFileService.logTempFileSummary();
memoryOptimizer.logMemorySummary();
dashboardService.logDashboardSummary();
```

## Testing

Comprehensive test suites are provided:

1. **Unit Tests**:
   - `performance-monitor.service.spec.ts`
   - `optimized-temp-file.service.spec.ts`
   - `memory-optimizer.service.spec.ts`

2. **Integration Tests**:
   - `scanned-pdf-performance-optimization.e2e-spec.ts`

3. **Performance Benchmarks**:
   - Memory optimization benchmarks
   - Temp file operation benchmarks
   - Metrics collection benchmarks

Run tests with:
```bash
npm test
npm run test:e2e
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**:
   - Check `MEMORY_GC_THRESHOLD_MB` setting
   - Ensure `NODE_OPTIONS="--expose-gc"` is set
   - Monitor buffer pool usage

2. **Temp File Accumulation**:
   - Verify cleanup interval settings
   - Check temp directory permissions
   - Monitor session cleanup

3. **Performance Alerts**:
   - Review processing time thresholds
   - Check system resources
   - Analyze slow sessions

### Debug Commands

```bash
# Check memory usage
node --expose-gc your-app.js

# Monitor temp files
ls -la /tmp/document-processing/

# Check system resources
htop
df -h
```

## Future Enhancements

1. **Advanced Memory Management**:
   - Memory pool for specific operations
   - Predictive memory allocation
   - Memory usage forecasting

2. **Enhanced Monitoring**:
   - Real-time dashboard UI
   - Custom alert rules
   - Performance trend analysis

3. **Auto-scaling**:
   - Dynamic resource allocation
   - Load-based optimization
   - Predictive scaling

This performance optimization system provides comprehensive monitoring, optimization, and management capabilities for scanned PDF processing, ensuring optimal performance and resource utilization.