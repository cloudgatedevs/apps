// Preserve Cloudgate's actionable error without exposing the response data or stack.
function responseMessage(body, depth = 0) {
  if (!body || depth > 3) return '';
  if (typeof body === 'string') {
    try { return responseMessage(JSON.parse(body), depth + 1); } catch { return ''; }
  }
  const message = body.Message ?? body.message;
  if (typeof message === 'string' && message.trim() && message.length <= 600 &&
      !/traceback|stack trace|<html|<script/i.test(message)) return message.trim();
  return responseMessage(body.error ?? body.Error ?? body.result, depth + 1);
}

export function explainApiError(error) {
  if (!/^Cloudgate responded \d+$/.test(error?.message || '')) return error;
  const message = responseMessage(error.body);
  if (message && error.status >= 400 && error.status < 500) error.message = message;
  return error;
}
