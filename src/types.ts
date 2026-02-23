export type Severity = 'error' | 'warning' | 'info';

export interface Issue {
  severity: Severity;
  file: string;
  field: string;
  message: string;
}

export interface FileReport {
  filePath: string;
  folderName: string;
  issues: Issue[];
}

export interface ScanReport {
  directory: string;
  totalFiles: number;
  totalSkills: number;
  totalErrors: number;
  totalWarnings: number;
  files: FileReport[];
}
