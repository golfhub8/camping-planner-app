// Helper function to detect unauthorized (401) errors
// Reference: blueprint:javascript_log_in_with_replit

export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}
