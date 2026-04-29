export interface AuthContext {
  userId: string;
  teamId: string;
}

export function parseBearerToken(header: string | null): string {
  if (!header || !header.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }
  return header.slice("Bearer ".length).trim();
}

export function verifyAccessToken(token: string): AuthContext {
  // Stub verification for MVP scaffold.
  // Replace with JWT verification (issuer/audience/signature) in production.
  const [userId, teamId] = token.split(":");
  if (!userId || !teamId) {
    throw new Error("Invalid access token format");
  }
  return { userId, teamId };
}
