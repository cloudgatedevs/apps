# Deliver composed app email through Cloudgate's tenant IdP pipeline.
# SMTP credentials stay in Cloudgate settings; preserve HTML and Reply-To.
import clr
clr.AddReference('Web.Core.Shared')
from Web.Core.Shared.Services.Endpoints.Engine import WorkflowSessionKeyExecutionContext
keys=list(WorkflowSessionKeyExecutionContext.GetKeys(int('${sessionid}')))
raw=[str(k.Value) for k in keys if str(k.Key).lower()=='orderemail']
msg=load_json(raw[-1] if raw else '',None)
if not isinstance(msg,dict) or not msg.get('to'):
    return out({'sent':False,'reason':'nothing to send'})
try:
    clr.AddReference('Abp')
    clr.AddReference('Zero.Core')
    from Abp.Dependency import IocManager
    from Zero.IdentityProvider.Emailing import WorkflowAppEmailSender
    sender=IocManager.Instance.Resolve[WorkflowAppEmailSender]()
    try:
        if msg.get('html'):
            sender.SendHtmlAsync(str(msg['to']),str(msg.get('subject') or '(no subject)'),str(msg['html']),str(msg.get('replyTo') or '')).GetAwaiter().GetResult()
        else:
            sender.SendAsync(str(msg['to']),str(msg.get('subject') or '(no subject)'),str(msg.get('text') or '')).GetAwaiter().GetResult()
    finally:IocManager.Instance.Release(sender)
    return out({'sent':True,'to':msg['to'],'reference':msg.get('reference'),'via':'Cloudgate email delivery'})
except Exception:
    return out({'sent':False,'reason':'Cloudgate could not deliver this email. Check the tenant email configuration and retry.','to':msg['to'],'reference':msg.get('reference')})
