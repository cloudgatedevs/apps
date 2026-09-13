"""Included in native notification worker. Claimed before SMTP side effects."""
def send_claimed(claim,settings):
    import smtplib,ssl
    from email.message import EmailMessage
    results=[]
    for m in claim.get('messages',[]):
        result=dict(ref=m['ref'],sent=False,error='')
        try:
            message=EmailMessage();message['From']=settings['smtp_from'];message['To']=m['recipient'];message['Subject']=m['subject'];message['Message-ID']='<jobs-'+hashlib.sha256(m['dedupe'].encode()).hexdigest()+'@'+settings['smtp_from'].split('@')[-1]+'>';message.set_content(m['body'])
            context=ssl.create_default_context();port=int(settings.get('smtp_port') or 587)
            with (smtplib.SMTP_SSL(settings['smtp_host'],port,timeout=10,context=context) if port==465 else smtplib.SMTP(settings['smtp_host'],port,timeout=10)) as server:
                if port!=465:server.starttls(context=context)
                if settings.get('smtp_user'):server.login(settings['smtp_user'],settings.get('smtp_password',''))
                server.send_message(message)
            result['sent']=True
        except Exception as ex:result['error']=type(ex).__name__
        results.append(result)
    return dict(claim=claim.get('claim'),results=results)
