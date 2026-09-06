// Turn a thrown value (usually a CloudgateError from @cloudgatedevs/cloudgate-client)
// into something a person can read.
//
// The gateway answers workflow failures with HTTP 400 and a body like
//   { "Message": "Price cannot be negative.", "HttpStatusCode": 400, ... }
// (the Message is whatever the Function node raised). Auth failures are 401/403
// with a similar envelope; ABP-hosted endpoints (IdP profile, file upload) use
//   { "error": { "message": "..." }, "success": false }.
import { CloudgateError } from '@cloudgatedevs/cloudgate-client';

export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;

  const body = err.body;
  if (body && typeof body === 'object') {
    const msg =
      body.Message ??
      body.message ??
      body.error?.message ??
      body.error?.details ??
      body.HttpStatusMessage;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  if (typeof body === 'string' && body.trim() && body.length < 300) return body.trim();

  if (err instanceof CloudgateError) {
    if (err.status === 401) return 'Please sign in to continue.';
    if (err.status === 403) return 'You do not have permission to do that.';
    if (err.status === 404) return 'That endpoint is not published yet.';
    if (err.status === 429) return 'Too many requests. Please slow down.';
    if (err.status >= 500) return 'The service is unavailable right now.';
  }
  return err.message || fallback;
}

export function isAuthError(err) {
  return err instanceof CloudgateError && (err.status === 401 || err.status === 403);
}
