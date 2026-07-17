declare const sessionIdBrand: unique symbol;

export type SessionId = string & { readonly [sessionIdBrand]: "SessionId" };

export interface SessionSource {
  readonly path: string;
  readonly role: string;
}

export interface Session {
  readonly adapterId: string;
  readonly id: SessionId;
  readonly nativeSessionId: string;
  readonly sources: readonly SessionSource[];
}

export interface CreateSessionInput {
  readonly adapterId: string;
  readonly nativeSessionId: string;
  readonly sources: readonly SessionSource[];
}

function deriveSessionId(adapterId: string, nativeSessionId: string): SessionId {
  // Source paths are deliberately excluded: moving a transcript must not create a new session.
  return JSON.stringify([adapterId, nativeSessionId]) as SessionId;
}

export function createSession(input: CreateSessionInput): Session {
  return {
    adapterId: input.adapterId,
    id: deriveSessionId(input.adapterId, input.nativeSessionId),
    nativeSessionId: input.nativeSessionId,
    sources: input.sources,
  };
}
