import { z } from "zod";

export const sessionSummarySchema = z.object({
  adapterId: z.string().min(1),
  id: z.string().min(1),
  identityOrigin: z.enum(["native", "inferred"]),
  modifiedAt: z.string().datetime({ offset: true }),
  nativeSessionId: z.string().min(1),
  projectPath: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative(),
  sourcePath: z.string().min(1),
  title: z.string().nullable(),
});

export const discoveryWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  path: z.string().min(1),
});

export const sessionsResponseSchema = z.object({
  projectsRoot: z.string().min(1),
  scannedAt: z.string().datetime({ offset: true }),
  sessions: z.array(sessionSummarySchema),
  warnings: z.array(discoveryWarningSchema),
});

export type SessionSummary = z.infer<typeof sessionSummarySchema>;
export type DiscoveryWarning = z.infer<typeof discoveryWarningSchema>;
export type SessionsResponse = z.infer<typeof sessionsResponseSchema>;
