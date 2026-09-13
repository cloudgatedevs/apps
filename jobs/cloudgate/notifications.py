"""Native worker: use Cloudgate tenant IdP transport; no app-stored SMTP secrets."""
def send_claimed(claim,settings=None):
    results=[]
    if not claim.get('messages'):return dict(claim=claim.get('claim'),results=results)
    import clr
    clr.AddReference('Abp')
    clr.AddReference('Zero.Core')
    from Abp.Dependency import IocManager
    from Zero.IdentityProvider.Emailing import WorkflowAppEmailSender
    sender=IocManager.Instance.Resolve[WorkflowAppEmailSender]()
    try:
        for m in claim.get('messages',[]):
            result=dict(ref=m['ref'],sent=False,error='')
            try:
                sender.SendAsync(m['recipient'],m['subject'],m['body']).GetAwaiter().GetResult()
                result['sent']=True
            except Exception as ex:result['error']=type(ex).__name__
            results.append(result)
    finally:IocManager.Instance.Release(sender)
    return dict(claim=claim.get('claim'),results=results)
