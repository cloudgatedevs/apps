# Included in the Cloudgate notification worker after engine.py.
# At-least-once delivery through standard Python SMTP.
def deliver(snapshot,now):
    jobs=[m for m in snapshot['messages'] if m['status']=='queued' and m['due']<=now and m['attempts']<5]
    jobs.sort(key=lambda m:m['due'])
    statements=[]
    for job in jobs[:5]:
        status='sent';err=''
        try:
            send_email(job['recipient'],job['subject'],text=job['body'])
        except Exception as ex:
            status='failed' if job['attempts']>=4 else 'queued';err=type(ex).__name__
        statements.append(update('messages',dict(status=status,attempts=job['attempts']+1,last_error=err,due=now+min(3600,60*2**job['attempts'])),'Id='+str(job['Id'])+" AND status='queued'"))
    # Delivery metadata does not alter the scheduling snapshot revision.
    return transaction(statements)+'\nSELECT '+q(encoded({'processed':len(jobs[:5])}))+' AS payload;'
