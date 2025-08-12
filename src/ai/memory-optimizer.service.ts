import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MemoryOptimizationConfig {
  enableGarbageCollection: boolean;
  gcThresholdMB: number;
  gcIntervalMs: number;
  enableMemoryPressureDetection: boolean;
  memoryPressureThresholdMB: number;
  enableBufferOptimization: boolean;
  maxBufferSizeMB: number;
}

export interface MemoryOptimizationResult {
  beforeMemory: NodeJS.MemoryUsage;
  afterMemory: NodeJS.MemoryUsage;
  freedMemoryMB: number;
  optimizationTime: number;
  optimizationsApplied: string[];
}

@Injectable()
export class MemoryOptimizerService {
  private readonly logger = new Logger(MemoryOptimizerService.name);
  
  private readonly config: MemoryOptimizationConfig;
  private gcInterval: NodeJS.Timeout;
  private lastGcTime: number = 0;
  private gcCount: number = 0;
  
  // Buffer management
  private readonly bufferPool: Map<string, Buffer> = new Map();
  private readonly maxPoolSize = 10;

  constructor(private readonly configService: ConfigService) {
    this.config = this.loadConfiguration();
    this.initializeOptimizations();
    this.logConfiguration();
  }

  /**
   * Load memory optimization configuration
   */
  private loadConfiguration(): MemoryOptimizationConfig {
    return {
      enableGarbageCollection: this.configService.get<boolean>('MEMORY_ENABLE_GC') !== false,
      gcThresholdMB: this.configService.get<number>('MEMORY_GC_THRESHOLD_MB') || 256,
      gcIntervalMs: this.configService.get<number>('MEMORY_GC_INTERVAL_MS') || 60000, // 1 minute
      enableMemoryPressureDetection: this.configService.get<boolean>('MEMORY_ENABLE_PRESSURE_DETECTION') !== false,
      memoryPressureThresholdMB: this.configService.get<number>('MEMORY_PRESSURE_THRESHOLD_MB') || 512,
      enableBufferOptimization: this.configService.get<boolean>('MEMORY_ENABLE_BUFFER_OPTIMIZATION') !== false,
      maxBufferSizeMB: this.configService.get<number>('MEMORY_MAX_BUFFER_SIZE_MB') || 50,
    };
  }

  /**
   * Initialize memory optimizations
   */
  private initializeOptimizations(): void {
    // Start periodic garbage collection if enabled
    if (this.config.enableGarbageCollection && global.gc) {
      this.startPeriodicGarbageCollection();
    } else if (this.config.enableGarbageCollection && !global.gc) {
      this.logger.warn('⚠️ Garbage collection requested but not available. Start Node.js with --expose-gc flag.');
    }

    // Set up memory pressure monitoring
    if (this.config.enableMemoryPressureDetection) {
      this.startMemoryPressureMonitoring();
    }
  }

  /**
   * Perform comprehensive memory optimization
   */
  async optimizeMemory(sessionId?: string): Promise<MemoryOptimizationResult> {
    const startTime = Date.now();
    const beforeMemory = process.memoryUsage();
    const optimizationsApplied: string[] = [];

    this.logger.log(`🧠 [${sessionId || 'system'}] Starting memory optimization`);
    this.logger.debug(`   Before: Heap ${this.formatBytes(beforeMemory.heapUsed)}/${this.formatBytes(beforeMemory.heapTotal)}, RSS ${this.formatBytes(beforeMemory.rss)}`);

    try {
      // 1. Clear buffer pool if enabled
      if (this.config.enableBufferOptimization) {
        this.clearBufferPool();
        optimizationsApplied.push('buffer_pool_cleared');
      }

      // 2. Force garbage collection if available and threshold met
      if (global.gc && this.shouldForceGarbageCollection(beforeMemory)) {
        this.forceGarbageCollection();
        optimizationsApplied.push('garbage_collection');
      }

      // 3. Clear require cache for non-essential modules (careful approach)
      this.clearNonEssentialCache();
      optimizationsApplied.push('cache_cleared');

      // 4. Optimize V8 heap if memory pressure detected
      if (this.isMemoryPressureDetected(beforeMemory)) {
        this.optimizeV8Heap();
        optimizationsApplied.push('v8_heap_optimized');
      }

      // Wait a moment for optimizations to take effect
      await new Promise(resolve => setTimeout(resolve, 100));

      const afterMemory = process.memoryUsage();
      const freedMemoryMB = (beforeMemory.heapUsed - afterMemory.heapUsed) / 1024 / 1024;
      const optimizationTime = Date.now() - startTime;

      this.logger.log(`✅ [${sessionId || 'system'}] Memory optimization completed in ${optimizationTime}ms`);
      this.logger.log(`   After: Heap ${this.formatBytes(afterMemory.heapUsed)}/${this.formatBytes(afterMemory.heapTotal)}, RSS ${this.formatBytes(afterMemory.rss)}`);
      this.logger.log(`   Freed: ${freedMemoryMB > 0 ? '+' : ''}${freedMemoryMB.toFixed(1)}MB`);
      this.logger.log(`   Applied: ${optimizationsApplied.join(', ')}`);

      return {
        beforeMemory,
        afterMemory,
        freedMemoryMB,
        optimizationTime,
        optimizationsApplied,
      };

    } catch (error) {
      this.logger.error(`❌ Memory optimization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Optimize memory specifically for PDF-to-image conversion
   */
  async optimizeForPdfConversion(sessionId: string): Promise<MemoryOptimizationResult> {
    this.logger.log(`🖼️ [${sessionId}] Optimizing memory for PDF conversion`);
    
    const result = await this.optimizeMemory(sessionId);
    
    // Additional PDF-specific optimizations
    if (this.config.enableBufferOptimization) {
      // Pre-allocate optimized buffers for image processing
      this.preAllocateImageBuffers();
      result.optimizationsApplied.push('image_buffers_preallocated');
    }

    return result;
  }

  /**
   * Optimize memory after PDF-to-image conversion
   */
  async optimizeAfterPdfConversion(sessionId: string): Promise<MemoryOptimizationResult> {
    this.logger.log(`🧹 [${sessionId}] Cleaning up memory after PDF conversion`);
    
    const result = await this.optimizeMemory(sessionId);
    
    // Additional cleanup for PDF conversion artifacts
    this.clearImageProcessingCache();
    result.optimizationsApplied.push('image_cache_cleared');

    return result;
  }

  /**
   * Get optimized buffer for image processing
   */
  getOptimizedBuffer(size: number, key?: string): Buffer {
    if (!this.config.enableBufferOptimization) {
      return Buffer.allocUnsafe(size);
    }

    const maxSize = this.config.maxBufferSizeMB * 1024 * 1024;
    if (size > maxSize) {
      this.logger.warn(`⚠️ Requested buffer size (${this.formatBytes(size)}) exceeds max (${this.formatBytes(maxSize)})`);
      return Buffer.allocUnsafe(size);
    }

    // Try to reuse existing buffer if available
    if (key && this.bufferPool.has(key)) {
      const existingBuffer = this.bufferPool.get(key);
      if (existingBuffer && existingBuffer.length >= size) {
        this.logger.debug(`♻️ Reusing buffer: ${key} (${this.formatBytes(existingBuffer.length)})`);
        return existingBuffer.subarray(0, size);
      }
    }

    // Create new optimized buffer
    const buffer = Buffer.allocUnsafe(size);
    
    // Store in pool if key provided and pool not full
    if (key && this.bufferPool.size < this.maxPoolSize) {
      this.bufferPool.set(key, buffer);
      this.logger.debug(`📦 Stored buffer in pool: ${key} (${this.formatBytes(size)})`);
    }

    return buffer;
  }

  /**
   * Release buffer back to pool or clear it
   */
  releaseBuffer(key: string): void {
    if (this.bufferPool.has(key)) {
      const buffer = this.bufferPool.get(key);
      if (buffer) {
        buffer.fill(0); // Clear sensitive data
        this.logger.debug(`🗑️ Released buffer: ${key}`);
      }
    }
  }

  /**
   * Get current memory usage with optimization recommendations
   */
  getMemoryStatus(): {
    usage: NodeJS.MemoryUsage;
    usageMB: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    recommendations: string[];
    bufferPoolSize: number;
    gcStats: {
      count: number;
      lastGcTime: number;
      timeSinceLastGc: number;
    };
  } {
    const usage = process.memoryUsage();
    const usageMB = {
      rss: usage.rss / 1024 / 1024,
      heapTotal: usage.heapTotal / 1024 / 1024,
      heapUsed: usage.heapUsed / 1024 / 1024,
      external: usage.external / 1024 / 1024,
    };

    const recommendations: string[] = [];

    // Generate recommendations based on current usage
    if (usageMB.heapUsed > this.config.gcThresholdMB) {
      recommendations.push('Consider running garbage collection');
    }

    if (usageMB.rss > this.config.memoryPressureThresholdMB) {
      recommendations.push('Memory pressure detected - optimize immediately');
    }

    if (this.bufferPool.size > this.maxPoolSize * 0.8) {
      recommendations.push('Buffer pool nearly full - consider clearing');
    }

    const heapUtilization = (usageMB.heapUsed / usageMB.heapTotal) * 100;
    if (heapUtilization > 80) {
      recommendations.push('High heap utilization - consider memory optimization');
    }

    return {
      usage,
      usageMB,
      recommendations,
      bufferPoolSize: this.bufferPool.size,
      gcStats: {
        count: this.gcCount,
        lastGcTime: this.lastGcTime,
        timeSinceLastGc: this.lastGcTime > 0 ? Date.now() - this.lastGcTime : 0,
      },
    };
  }

  /**
   * Start periodic garbage collection
   */
  private startPeriodicGarbageCollection(): void {
    this.gcInterval = setInterval(() => {
      const memory = process.memoryUsage();
      if (this.shouldForceGarbageCollection(memory)) {
        this.forceGarbageCollection();
      }
    }, this.config.gcIntervalMs);

    this.logger.log(`🗑️ Started periodic garbage collection (${this.config.gcIntervalMs}ms interval, ${this.config.gcThresholdMB}MB threshold)`);
  }

  /**
   * Start memory pressure monitoring
   */
  private startMemoryPressureMonitoring(): void {
    const checkInterval = Math.min(this.config.gcIntervalMs, 30000); // Check at least every 30s
    
    setInterval(() => {
      const memory = process.memoryUsage();
      if (this.isMemoryPressureDetected(memory)) {
        this.logger.warn(`🚨 Memory pressure detected: ${this.formatBytes(memory.rss)} RSS, ${this.formatBytes(memory.heapUsed)} heap used`);
        // Trigger automatic optimization
        this.optimizeMemory('auto_pressure').catch(error => {
          this.logger.error(`❌ Auto memory optimization failed: ${error.message}`);
        });
      }
    }, checkInterval);

    this.logger.log(`📊 Started memory pressure monitoring (${this.config.memoryPressureThresholdMB}MB threshold)`);
  }

  /**
   * Check if garbage collection should be forced
   */
  private shouldForceGarbageCollection(memory: NodeJS.MemoryUsage): boolean {
    const heapUsedMB = memory.heapUsed / 1024 / 1024;
    const timeSinceLastGc = Date.now() - this.lastGcTime;
    
    return heapUsedMB > this.config.gcThresholdMB && timeSinceLastGc > 30000; // At least 30s between GCs
  }

  /**
   * Force garbage collection
   */
  private forceGarbageCollection(): void {
    if (global.gc) {
      const beforeHeap = process.memoryUsage().heapUsed;
      global.gc();
      const afterHeap = process.memoryUsage().heapUsed;
      const freedMB = (beforeHeap - afterHeap) / 1024 / 1024;
      
      this.gcCount++;
      this.lastGcTime = Date.now();
      
      this.logger.debug(`🗑️ Forced garbage collection: freed ${freedMB.toFixed(1)}MB (count: ${this.gcCount})`);
    }
  }

  /**
   * Check if memory pressure is detected
   */
  private isMemoryPressureDetected(memory: NodeJS.MemoryUsage): boolean {
    const rssMB = memory.rss / 1024 / 1024;
    return rssMB > this.config.memoryPressureThresholdMB;
  }

  /**
   * Clear buffer pool
   */
  private clearBufferPool(): void {
    const poolSize = this.bufferPool.size;
    this.bufferPool.clear();
    
    if (poolSize > 0) {
      this.logger.debug(`🧹 Cleared buffer pool: ${poolSize} buffers`);
    }
  }

  /**
   * Clear non-essential require cache
   */
  private clearNonEssentialCache(): void {
    // Only clear specific modules that are safe to reload
    const safeToClear = [
      'pdf-parse',
      'pdf2pic',
    ];

    let clearedCount = 0;
    Object.keys(require.cache).forEach(key => {
      if (safeToClear.some(module => key.includes(module))) {
        delete require.cache[key];
        clearedCount++;
      }
    });

    if (clearedCount > 0) {
      this.logger.debug(`🧹 Cleared require cache: ${clearedCount} modules`);
    }
  }

  /**
   * Optimize V8 heap
   */
  private optimizeV8Heap(): void {
    // Trigger multiple GC cycles for thorough cleanup
    if (global.gc) {
      for (let i = 0; i < 3; i++) {
        global.gc();
      }
      this.logger.debug('🔧 Performed V8 heap optimization');
    }
  }

  /**
   * Pre-allocate optimized buffers for image processing
   */
  private preAllocateImageBuffers(): void {
    const commonSizes = [
      1024 * 1024,      // 1MB
      5 * 1024 * 1024,  // 5MB
      10 * 1024 * 1024, // 10MB
    ];

    commonSizes.forEach((size, index) => {
      const key = `image_buffer_${index}`;
      if (!this.bufferPool.has(key)) {
        this.getOptimizedBuffer(size, key);
      }
    });

    this.logger.debug('📦 Pre-allocated image processing buffers');
  }

  /**
   * Clear image processing cache
   */
  private clearImageProcessingCache(): void {
    // Clear image-related buffers from pool
    const imageKeys = Array.from(this.bufferPool.keys()).filter(key => key.includes('image'));
    imageKeys.forEach(key => {
      this.bufferPool.delete(key);
    });

    if (imageKeys.length > 0) {
      this.logger.debug(`🧹 Cleared image processing cache: ${imageKeys.length} buffers`);
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Log configuration on startup
   */
  private logConfiguration(): void {
    this.logger.log('🧠 Memory Optimizer Configuration:');
    this.logger.log(`   Garbage Collection: ${this.config.enableGarbageCollection ? 'ENABLED' : 'DISABLED'}`);
    this.logger.log(`   GC Threshold: ${this.config.gcThresholdMB}MB`);
    this.logger.log(`   Memory Pressure Detection: ${this.config.enableMemoryPressureDetection ? 'ENABLED' : 'DISABLED'}`);
    this.logger.log(`   Pressure Threshold: ${this.config.memoryPressureThresholdMB}MB`);
    this.logger.log(`   Buffer Optimization: ${this.config.enableBufferOptimization ? 'ENABLED' : 'DISABLED'}`);
    this.logger.log(`   Max Buffer Size: ${this.config.maxBufferSizeMB}MB`);
  }

  /**
   * Log comprehensive memory summary
   */
  logMemorySummary(): void {
    const status = this.getMemoryStatus();
    
    this.logger.log('🧠 === MEMORY OPTIMIZATION SUMMARY ===');
    this.logger.log('💾 Current Usage:');
    this.logger.log(`   RSS: ${status.usageMB.rss.toFixed(1)}MB`);
    this.logger.log(`   Heap Total: ${status.usageMB.heapTotal.toFixed(1)}MB`);
    this.logger.log(`   Heap Used: ${status.usageMB.heapUsed.toFixed(1)}MB (${((status.usageMB.heapUsed / status.usageMB.heapTotal) * 100).toFixed(1)}%)`);
    this.logger.log(`   External: ${status.usageMB.external.toFixed(1)}MB`);
    
    this.logger.log('🗑️ Garbage Collection:');
    this.logger.log(`   Count: ${status.gcStats.count}`);
    this.logger.log(`   Last GC: ${status.gcStats.lastGcTime > 0 ? `${(status.gcStats.timeSinceLastGc / 1000).toFixed(0)}s ago` : 'Never'}`);
    
    this.logger.log('📦 Buffer Pool:');
    this.logger.log(`   Size: ${status.bufferPoolSize}/${this.maxPoolSize}`);
    
    if (status.recommendations.length > 0) {
      this.logger.log('💡 Recommendations:');
      status.recommendations.forEach(rec => {
        this.logger.log(`   • ${rec}`);
      });
    }
    
    this.logger.log('='.repeat(50));
  }
}