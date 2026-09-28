export interface DiscoverySessionSummary {
  readonly nativeSessionId: string;
  readonly sourcePath: string;
  readonly projectPath: string;
  readonly title: string;
  readonly modifiedAt: string;
  readonly sizeBytes: number;
  readonly identityOrigin: string;
}

export interface DiscoveryWarning {
  readonly code: string;
  readonly message: string;
}

export interface DiscoveryResult {
  readonly adapterId: string;
  readonly sessions: readonly DiscoverySessionSummary[];
  readonly warnings: readonly DiscoveryWarning[];
}
