export interface TableColumn {
  name: string;
  type: string;
  required: boolean;
  description: string;
  format: string;
}

export interface TableSchema {
  name: string;
  columns: TableColumn[];
  hasUserId: boolean;
}

export interface ConnectionStatus {
  status: "connected" | "misconfigured" | "error" | "checking";
  message: string;
  url: string | null;
  tableCount: number;
  passwordSet: boolean;
}

export interface QueryResult {
  data: Record<string, any>[];
  count: number;
  unfilteredCount?: number;
  page: number;
  pageSize: number;
}

export interface DuplicateGroup {
  value: string;
  ids: any[];
  count: number;
}

export interface DuplicateScanResult {
  targetColumns: string[];
  duplicates: Record<string, DuplicateGroup[]>;
}
