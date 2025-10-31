/**
 * Advanced Data Table Utilities
 * Helper functions for export, import, and data manipulation
 * @module advanced-data-table/utils
 */

import type { Row, RowData } from '@tanstack/react-table';
import type { ExportFormat, AdvancedDataTableError } from './types';

/**
 * Create export error
 */
function createExportError(
  format: ExportFormat,
  message: string,
  cause?: unknown
): AdvancedDataTableError {
  return { type: 'export', format, message, cause };
}

/**
 * Create import error
 */
function _createImportError(
  fileName: string,
  message: string,
  cause?: unknown
): AdvancedDataTableError {
  return { type: 'import', fileName, message, cause };
}

/**
 * Export table data to CSV format
 * @throws {AdvancedDataTableError} If export fails
 */
export async function exportToCSV<TData extends RowData>(
  rows: readonly Row<TData>[],
  filename: string = 'export.csv'
): Promise<void> {
  if (rows.length === 0) {
    throw createExportError('csv', 'No data to export');
  }

  try {
    const headers = Object.keys(rows[0].original as object);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = (row.original as Record<string, unknown>)[header];
            // Escape commas and quotes in CSV
            const stringValue = String(value ?? '');
            return stringValue.includes(',') || stringValue.includes('"')
              ? `"${stringValue.replace(/"/g, '""')}"`
              : stringValue;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, filename);
  } catch (error) {
    throw createExportError('csv', 'Failed to generate CSV file', error);
  }
}

/**
 * Export table data to JSON format
 * @throws {AdvancedDataTableError} If export fails
 */
export async function exportToJSON<TData extends RowData>(
  rows: readonly Row<TData>[],
  filename: string = 'export.json'
): Promise<void> {
  if (rows.length === 0) {
    throw createExportError('json', 'No data to export');
  }

  try {
    const data = rows.map((row) => row.original);
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    downloadBlob(blob, filename);
  } catch (error) {
    throw createExportError('json', 'Failed to generate JSON file', error);
  }
}

/**
 * Export table data to Excel format (using CSV with .xlsx extension)
 * Note: For true Excel export, consider using a library like xlsx
 * @throws {AdvancedDataTableError} If export fails
 */
export async function exportToExcel<TData extends RowData>(
  rows: readonly Row<TData>[],
  filename: string = 'export.xlsx'
): Promise<void> {
  try {
    // For now, export as CSV (in production, use 'xlsx' or 'exceljs')
    await exportToCSV(rows, filename.replace('.xlsx', '.csv'));
  } catch (error) {
    throw createExportError('excel', 'Failed to generate Excel file', error);
  }
}

/**
 * Export table data to PDF format
 * Note: This requires a PDF library like jsPDF
 * @throws {AdvancedDataTableError} If export fails
 */
export async function exportToPDF<TData extends RowData>(
  rows: readonly Row<TData>[],
  filename: string = 'export.pdf'
): Promise<void> {
  try {
    // Placeholder - implement with jsPDF or similar library
    console.warn('[Export] PDF export not yet implemented. Using JSON instead.');
    await exportToJSON(rows, filename.replace('.pdf', '.json'));
  } catch (error) {
    throw createExportError('pdf', 'Failed to generate PDF file', error);
  }
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Parse CSV file to array of objects
 */
export async function parseCSV(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map((h) => h.trim());

        const data = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim());
          const obj: Record<string, unknown> = {};
          headers.forEach((header, index) => {
            obj[header] = values[index];
          });
          return obj;
        });

        resolve(data.filter((row) => Object.values(row).some((v) => v)));
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Parse Excel file to array of objects
 * Note: This requires a library like xlsx
 */
export async function parseExcel(file: File): Promise<Record<string, unknown>[]> {
  // Placeholder - implement with xlsx library
  console.warn('Excel import not yet implemented. Use CSV instead.');
  return parseCSV(file);
}

/**
 * Parse JSON file to array of objects
 */
export async function parseJSON(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        resolve(Array.isArray(data) ? data : [data]);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Main export function that handles all formats
 * @throws {AdvancedDataTableError} If export fails
 */
export async function exportData<TData extends RowData>(
  format: ExportFormat,
  rows: readonly Row<TData>[],
  filename?: string
): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[0];
  const defaultFilename = `export-${timestamp}`;

  switch (format) {
    case 'csv':
      await exportToCSV(rows, filename ?? `${defaultFilename}.csv`);
      break;
    case 'excel':
      await exportToExcel(rows, filename ?? `${defaultFilename}.xlsx`);
      break;
    case 'pdf':
      await exportToPDF(rows, filename ?? `${defaultFilename}.pdf`);
      break;
    case 'json':
      await exportToJSON(rows, filename ?? `${defaultFilename}.json`);
      break;
    default:
      throw createExportError(format, `Unsupported export format: ${format}`);
  }
}

/**
 * Main import function that handles all formats
 */
export async function importData(file: File): Promise<Record<string, unknown>[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'csv':
      return parseCSV(file);
    case 'xlsx':
    case 'xls':
      return parseExcel(file);
    case 'json':
      return parseJSON(file);
    default:
      throw new Error(`Unsupported file format: ${extension}`);
  }
}

/**
 * Debounce function for search inputs with proper cleanup
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function with cancel method
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;

  const debounced = function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };

  debounced.cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}

/**
 * Throttle function for performance-critical operations with proper cleanup
 * @param func - Function to throttle
 * @param limit - Throttle limit in milliseconds
 * @returns Throttled function with cancel method
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let inThrottle = false;
  let timeout: NodeJS.Timeout | null = null;

  const throttled = function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      timeout = setTimeout(() => {
        inThrottle = false;
        timeout = null;
      }, limit);
    }
  };

  throttled.cancel = () => {
    inThrottle = false;
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return throttled;
}
