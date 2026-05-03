// Clerk token bridge — sets up the API client to use Clerk's session token as Bearer.
// This is the only auth context needed after Clerk migration.
// The old JWT-based AuthProvider has been replaced by Clerk.
import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export function ClerkTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  return null;
}
