// Clerk token bridge — sets up the API client to use Clerk's session token as Bearer.
// This is the only auth context needed after Clerk migration.
// The old JWT-based AuthProvider has been replaced by Clerk.
import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export { useAuth } from "@clerk/react";

/** Check if the error response is a rate limit and handle accordingly */
export function handleAuthRateLimit(error: unknown): boolean {
  const err = error as { response?: { status?: number }; status?: number };
  const status = err?.response?.status ?? err?.status;
  if (status === 429) {
    return true; // caller should show rate-limit message
  }
  return false;
}

export function ClerkTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  return null;
}
