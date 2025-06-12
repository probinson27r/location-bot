/**
 * Simple performance monitoring utility for tracking deployment and startup performance
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.startTime = Date.now();
    }

    /**
     * Start measuring a metric
     */
    startMeasure(name) {
        this.metrics.set(name, {
            start: Date.now(),
            end: null,
            duration: null
        });
    }

    /**
     * End measuring a metric
     */
    endMeasure(name) {
        const metric = this.metrics.get(name);
        if (metric) {
            metric.end = Date.now();
            metric.duration = metric.end - metric.start;
            console.log(`⏱️ ${name}: ${metric.duration}ms`);
        }
    }

    /**
     * Get total startup time
     */
    getTotalStartupTime() {
        return Date.now() - this.startTime;
    }

    /**
     * Get all metrics
     */
    getAllMetrics() {
        const result = {};
        for (const [name, metric] of this.metrics) {
            result[name] = {
                duration: metric.duration,
                start: new Date(metric.start).toISOString(),
                end: metric.end ? new Date(metric.end).toISOString() : null
            };
        }
        result.totalStartupTime = this.getTotalStartupTime();
        return result;
    }

    /**
     * Log startup summary
     */
    logStartupSummary() {
        const total = this.getTotalStartupTime();
        console.log(`\n🚀 Application startup completed in ${total}ms`);
        
        // Log individual metrics
        for (const [name, metric] of this.metrics) {
            if (metric.duration) {
                const percentage = ((metric.duration / total) * 100).toFixed(1);
                console.log(`   • ${name}: ${metric.duration}ms (${percentage}%)`);
            }
        }
        console.log('');
    }
}

module.exports = PerformanceMonitor; 