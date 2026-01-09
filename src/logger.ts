export interface OCRLogEntry {
    timestamp: number;
    rawOCR: string;
    cleanedText: string;
    parsedData: {
        world: number;
        location: string;
        size: string;
        time: string;
    };
    finalCommand: string;
    processingTime?: number;
}

export class OCRLogger {
    private static instance: OCRLogger;
    private readonly STORAGE_KEY = 'starfind_ocr_logs';
    private readonly MAX_LOG_ENTRIES = 500;

    private constructor() {}

    public static getInstance(): OCRLogger {
        if (!OCRLogger.instance) {
            OCRLogger.instance = new OCRLogger();
        }
        return OCRLogger.instance;
    }

    public addLog(entry: OCRLogEntry): void {
        try {
            const logs = this.getLogs();
            logs.push(entry);

            // Keep only the most recent MAX_LOG_ENTRIES
            if (logs.length > this.MAX_LOG_ENTRIES) {
                logs.splice(0, logs.length - this.MAX_LOG_ENTRIES);
            }

            this.saveLogs(logs);
        } catch (error) {
            // Handle QuotaExceededError by clearing old logs and retrying
            if (
                error instanceof DOMException &&
                (error.name === 'QuotaExceededError' ||
                    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                    error.code === 22 ||
                    error.code === 1014)
            ) {
                console.warn(
                    'Storage quota exceeded, clearing old logs and retrying'
                );
                this.clearOldLogs(Math.floor(this.MAX_LOG_ENTRIES / 2));
                try {
                    const logs = this.getLogs();
                    logs.push(entry);
                    this.saveLogs(logs);
                } catch (retryError) {
                    console.error(
                        'Failed to save log after retry:',
                        retryError
                    );
                }
            } else {
                console.error('Error saving log:', error);
            }
        }
    }

    public getLogs(): OCRLogEntry[] {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (!stored) {
                return [];
            }
            return JSON.parse(stored) as OCRLogEntry[];
        } catch (error) {
            console.error('Error parsing logs from storage:', error);
            return [];
        }
    }

    public clearLogs(): void {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch (error) {
            console.error('Error clearing logs:', error);
        }
    }

    public clearOldLogs(keepCount: number): void {
        try {
            const logs = this.getLogs();
            if (logs.length > keepCount) {
                const recentLogs = logs.slice(-keepCount);
                this.saveLogs(recentLogs);
            }
        } catch (error) {
            console.error('Error clearing old logs:', error);
        }
    }

    public exportAsJSON(): void {
        try {
            const logs = this.getLogs();
            const dataStr = JSON.stringify(logs, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const timestamp = this.getTimestampForFilename();
            const filename = `ocr_logs_${timestamp}.json`;

            this.downloadBlob(dataBlob, filename);
        } catch (error) {
            console.error('Error exporting logs as JSON:', error);
        }
    }

    public exportAsCSV(): void {
        try {
            const logs = this.getLogs();
            if (logs.length === 0) {
                console.warn('No logs to export');
                return;
            }

            // CSV headers
            const headers = [
                'Timestamp',
                'Date',
                'Raw OCR',
                'Cleaned Text',
                'World',
                'Location',
                'Size',
                'Time',
                'Final Command',
                'Processing Time (ms)',
            ];

            // Build CSV rows
            const rows = logs.map((log) => {
                const date = new Date(log.timestamp).toISOString();
                return [
                    log.timestamp,
                    date,
                    this.escapeCSV(log.rawOCR),
                    this.escapeCSV(log.cleanedText),
                    log.parsedData.world,
                    this.escapeCSV(log.parsedData.location),
                    this.escapeCSV(log.parsedData.size),
                    this.escapeCSV(log.parsedData.time),
                    this.escapeCSV(log.finalCommand),
                    log.processingTime || '',
                ].join(',');
            });

            const csvContent = [headers.join(','), ...rows].join('\n');
            const dataBlob = new Blob([csvContent], { type: 'text/csv' });

            const timestamp = this.getTimestampForFilename();
            const filename = `ocr_logs_${timestamp}.csv`;

            this.downloadBlob(dataBlob, filename);
        } catch (error) {
            console.error('Error exporting logs as CSV:', error);
        }
    }

    public getStats(): {
        total: number;
        errors: number;
        avgProcessingTime: number;
        oldestLog: number | null;
        newestLog: number | null;
    } {
        try {
            const logs = this.getLogs();

            if (logs.length === 0) {
                return {
                    total: 0,
                    errors: 0,
                    avgProcessingTime: 0,
                    oldestLog: null,
                    newestLog: null,
                };
            }

            // Count errors (entries where location or size is 'ERR')
            const errors = logs.filter(
                (log) =>
                    log.parsedData.location === 'ERR' ||
                    log.parsedData.size === 'ERR'
            ).length;

            // Calculate average processing time
            const logsWithTime = logs.filter((log) => log.processingTime);
            const avgProcessingTime =
                logsWithTime.length > 0
                    ? Math.round(
                          logsWithTime.reduce(
                              (sum, log) => sum + (log.processingTime || 0),
                              0
                          ) / logsWithTime.length
                      )
                    : 0;

            // Get oldest and newest timestamps
            const timestamps = logs.map((log) => log.timestamp);
            const oldestLog = Math.min(...timestamps);
            const newestLog = Math.max(...timestamps);

            return {
                total: logs.length,
                errors,
                avgProcessingTime,
                oldestLog,
                newestLog,
            };
        } catch (error) {
            console.error('Error calculating stats:', error);
            return {
                total: 0,
                errors: 0,
                avgProcessingTime: 0,
                oldestLog: null,
                newestLog: null,
            };
        }
    }

    private saveLogs(logs: OCRLogEntry[]): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    }

    private getTimestampForFilename(): string {
        return new Date().toISOString().replace(/[:.]/g, '-');
    }

    private escapeCSV(value: string | number): string {
        const str = String(value);
        // Escape quotes by doubling them and wrap in quotes if contains comma, quote, newline, carriage return, or tab
        if (
            str.includes(',') ||
            str.includes('"') ||
            str.includes('\n') ||
            str.includes('\r') ||
            str.includes('\t')
        ) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    private downloadBlob(blob: Blob, filename: string): void {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
