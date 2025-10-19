/**
 * Advanced Data Table Utilities
 * Helper functions for export, import, and data manipulation
 */

import type { Row } from '@tanstack/react-table';
import type { ExportFormat } from './types';

/**
 * Export table data to CSV format
 */
export async function exportToCSV<TData>(
  rows: Row<TData>[],
  filename: string = 'export.csv'
): Promise<void> {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0].original as object);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = (row.original as any)[header];
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
}

/**
 * Export table data to JSON format
 */
export async function exportToJSON<TData>(
  rows: Row<TData>[],
  filename: string = 'export.json'
): Promise<void> {
  const data = rows.map((row) => row.original);
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  downloadBlob(blob, filename);
}

/**
 * Export table data to Excel format (using CSV with .xlsx extension)
 * Note: For true Excel export, consider using a library like xlsx
 */
export async function exportToExcel<TData>(
  rows: Row<TData>[],
  filename: string = 'export.xlsx'
): Promise<void> {
  // For now, we'll export as CSV with .xlsx extension
  // In production, use a library like 'xlsx' or 'exceljs'
  await exportToCSV(rows, filename.replace('.xlsx', '.csv'));
}

/**
 * Export table data to PDF format
 * Note: This requires a PDF library like jsPDF
 */
export async function exportToPDF<TData>(
  rows: Row<TData>[],
  filename: string = 'export.pdf'
): Promise<void> {
  // Placeholder - implement with jsPDF or similar library
  console.warn('PDF export not yet implemented. Use CSV or Excel instead.');
  await exportToJSON(rows, filename.replace('.pdf', '.json'));
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
export async function parseCSV(file: File): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map((h) => h.trim());

        const data = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim());
          const obj: Record<string, any> = {};
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
export async function parseExcel(file: File): Promise<Record<string, any>[]> {
  // Placeholder - implement with xlsx library
  console.warn('Excel import not yet implemented. Use CSV instead.');
  return parseCSV(file);
}

/**
 * Parse JSON file to array of objects
 */
export async function parseJSON(file: File): Promise<Record<string, any>[]> {
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
 */
export async function exportData<TData>(
  format: ExportFormat,
  rows: Row<TData>[],
  filename?: string
): Promise<void> {
  const timestamp = new Date().toISOString().split('T')[0];
  const defaultFilename = `export-${timestamp}`;

  switch (format) {
    case 'csv':
      await exportToCSV(rows, filename || `${defaultFilename}.csv`);
      break;
    case 'excel':
      await exportToExcel(rows, filename || `${defaultFilename}.xlsx`);
      break;
    case 'pdf':
      await exportToPDF(rows, filename || `${defaultFilename}.pdf`);
      break;
    case 'json':
      await exportToJSON(rows, filename || `${defaultFilename}.json`);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Main import function that handles all formats
 */
export async function importData(file: File): Promise<Record<string, any>[]> {
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
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for performance-critical operations
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
