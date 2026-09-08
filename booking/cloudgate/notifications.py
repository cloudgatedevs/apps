# Included in the Cloudgate notification worker after engine.py.
# At-least-once SMTP delivery: deterministic Message-ID aids receiver deduplication.
def deliver(snapshot,now):
    import smtplib
    import ssl
    from email.message import EmailMessage
    s={r['key']:r['value'] for r in snapshot['settings']}
    if not s.get('smtp_host') or not s.get('smtp_from'):return "SELECT '{\"configured\":false}' AS payload;"
    jobs=[m for m in snapshot['messages'] if m['status']=='queued' and m['due']<=now and m['attempts']<5]
    jobs.sort(key=lambda m:m['due'])
    statements=[]
    for job in jobs[:5]:
        status='sent';err=''
        try:
            message=EmailMessage();message['To']=job['recipient'];message['From']=s['smtp_from'];message['Subject']=job['subject'];message['Message-ID']='<booking-'+hashlib.sha256(job['dedupe'].encode()).hexdigest()+'@'+s['smtp_from'].split('@')[-1]+'>';message.set_content(job['body'])
            context=ssl.create_default_context();port=int(s.get('smtp_port') or 587)
            server=smtplib.SMTP_SSL(s['smtp_host'],port,timeout=10,context=context) if s.get('smtp_mode')=='ssl' else smtplib.SMTP(s['smtp_host'],port,timeout=10)
            with server:
                server.ehlo()
                if s.get('smtp_mode')!='ssl':server.starttls(context=context);server.ehlo()
                if s.get('smtp_user'):server.login(s['smtp_user'],s.get('smtp_password',''))
                server.send_message(message)
        except Exception as ex:
            status='failed' if job['attempts']>=4 else 'queued';err=type(ex).__name__
        statements.append(update('messages',dict(status=status,attempts=job['attempts']+1,last_error=err,due=now+min(3600,60*2**job['attempts'])),'Id='+str(job['Id'])+" AND status='queued'"))
    # Delivery metadata does not alter the scheduling snapshot revision.
    return 'BEGIN IMMEDIATE;\n'+'\n'.join(statements)+'\nCOMMIT;\nSELECT '+q(encoded({'processed':len(jobs[:5])}))+' AS payload;'
