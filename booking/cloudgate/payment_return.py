"""Inlined into checkout nodes; return to the browser's site unless overridden."""
import ipaddress as _payment_ip
import re as _payment_re
from urllib.parse import urlsplit as _payment_split


def payment_return_base(configured='', origin='', fallback=''):
    override = str(configured or '').strip()
    raw = override or str(origin or fallback or '').strip()
    if not raw:
        raise ValueError('Open checkout from the app website, or configure a website URL for server-initiated payments.')
    message = 'Payment return address must be an HTTPS website URL (HTTP is allowed for localhost development).'
    if len(raw) > 2048 or any(c.isspace() or ord(c) < 32 or c in (chr(92), '<', '>', chr(34), chr(39), '?', '#') for c in raw):
        raise ValueError(message)
    try:
        url = _payment_split(raw)
        host = url.hostname or ''
        port = url.port
        if not host or url.username is not None or url.password is not None or (port is not None and port < 1):
            raise ValueError(message)
        try:
            local = _payment_ip.ip_address(host).is_loopback
        except ValueError:
            host = host.encode('idna').decode('ascii').lower()
            if not _payment_re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', host):
                raise ValueError(message)
            local = host == 'localhost' or host.endswith('.localhost')
        if url.scheme != 'https' and not (url.scheme == 'http' and local):
            raise ValueError(message)
        # Browser Origin (or a legacy returnBase) contains no path. An admin override
        # may include the application's base path; callback paths are added by us.
        if not override and url.path not in ('', '/'):
            raise ValueError('Payment return origin must not contain a path.')
        authority = '[' + host + ']' if ':' in host else host
        if port is not None and port != (443 if url.scheme == 'https' else 80):
            authority += ':' + str(port)
        return url.scheme + '://' + authority + url.path.rstrip('/')
    except (ValueError, UnicodeError):
        raise ValueError(message)


def payment_request_value(name):
    # Read HTTP headers as data, never interpolate an untrusted Origin into Python.
    import clr
    clr.AddReference('Web.Core.Shared')
    from Web.Core.Shared.Services.Endpoints.Engine import WorkflowSessionKeyExecutionContext
    keys = WorkflowSessionKeyExecutionContext.GetKeys(int('${sessionid}'))
    matches = [str(k.Value) for k in keys if str(k.Key).lower() == name.lower()]
    return matches[-1] if matches else ''
