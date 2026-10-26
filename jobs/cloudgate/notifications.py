"""Deliver claimed messages with Python standard-library SMTP."""
def send_claimed(claim, settings=None):
    results = []
    for message in claim.get('messages', []):
        result = dict(ref=message['ref'], sent=False, error='')
        try:
            send_email(message['recipient'], message['subject'], text=message['body'])
            result['sent'] = True
        except Exception as error:
            result['error'] = type(error).__name__
        results.append(result)
    return dict(claim=claim.get('claim'), results=results)
