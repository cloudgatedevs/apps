import re,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
binding='''"""Package standard Python scripts with ordinary workflow selector inputs."""
import re

def bind_inputs(source):
    names={'body','Snapshot','Run','IdpAuth'}
    names.update(re.findall(r"(?:value|obj|snapshot|payment_request_value)\\(\\s*['\\\"]([A-Za-z_][A-Za-z_0-9]*)['\\\"]",source))
    # Selectors are bound as data by the existing workflow runtime. Python only
    # receives strings; it never resolves host services or invokes a bridge.
    inputs=', '.join(repr(name)+': '+repr('${'+name+'}') for name in sorted(names))
    return '_inputs = {'+inputs+'}\\n'+source
'''
smtp='''"""SMTP delivery using only the Python standard library.
Credentials arrive as encrypted workflow selectors, separate from app data.
"""
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

def send_email(to,subject,text='',html='',reply_to=''):
    host=value('SMTP_HOST').strip()
    username=value('SMTP_USERNAME').strip()
    password=value('SMTP_PASSWORD')
    sender=value('SMTP_FROM_EMAIL').strip()
    sender_name=value('SMTP_FROM_NAME').strip()
    security=(value('SMTP_SECURITY') or 'starttls').strip().lower()
    if not host or not sender:raise ValueError('Configure SMTP_HOST and SMTP_FROM_EMAIL selectors.')
    if security not in ('starttls','ssl'):raise ValueError('SMTP_SECURITY must be starttls or ssl.')
    port=int(value('SMTP_PORT') or (465 if security=='ssl' else 587))
    message=EmailMessage()
    message['From']=formataddr((sender_name,sender))
    message['To']=to
    message['Subject']=subject
    if reply_to:message['Reply-To']=reply_to
    message.set_content(text)
    if html:message.add_alternative(html,subtype='html')
    context=ssl.create_default_context()
    connection=smtplib.SMTP_SSL(host,port,timeout=20,context=context) if security=='ssl' else smtplib.SMTP(host,port,timeout=20)
    with connection as client:
        if security=='starttls':client.starttls(context=context)
        if username:client.login(username,password)
        rejected=client.send_message(message)
        if rejected:raise RuntimeError('SMTP recipient rejected.')
    return True
'''
keys=[dict(Name='SMTP_'+name,Type=2,IsGlobal=False,StaticValue=default,StaticValueProd=default) for name,default in [('HOST',''),('PORT','587'),('USERNAME',''),('PASSWORD',''),('FROM_EMAIL',''),('FROM_NAME',''),('SECURITY','starttls')]]
for app in ['shop','pos','booking','jobs','courses','events']:
    root=ROOT/app/'cloudgate'
    (root/'workflow_inputs.py').write_text(binding,encoding='utf8')
    (root/'smtp_email.py').write_text(smtp,encoding='utf8')
    (root/'email-selectors.json').write_text(json.dumps(keys,indent=2)+'\n',encoding='utf8')
    p=root/'payment_return.py';s=p.read_text(encoding='utf8')
    s=s.replace('    import cloudgate\n','').replace('return cloudgate.value(name)','return value(name)')
    p.write_text(s,encoding='utf8')
    if app in ['shop','pos']:
        p=root/'workflows/_shared/lib.py';s=p.read_text(encoding='utf8').replace('import cloudgate\n','')
        start=s.index('def value(');end=s.index('\ndef load_json',start)
        s=s[:start]+"def value(name):\n    return _inputs.get(name, '')\n\n"+s[end:];p.write_text(s,encoding='utf8')
        p=root/'refund_bridge.py';s=p.read_text(encoding='utf8').replace('import cloudgate\n','');start=s.index('def value(');end=s.index('\ndef obj',start)
        s=s[:start]+"def value(name):\n    return _inputs.get(name, '')\n\n"+s[end:]
        (root/'workflow_data.py').write_text(s,encoding='utf8');p.unlink()
        for p in (root/'workflows').rglob('workflow.json'):
            s=p.read_text(encoding='utf8').replace('refund_bridge.py','workflow_data.py');p.write_text(s,encoding='utf8')
        p=root/'workflows/_shared/send_email.py';s=p.read_text(encoding='utf8').replace('import cloudgate\n','').replace('cloudgate.value','value').replace('cloudgate.send_app_email','send_email').replace('Cloudgate email delivery','SMTP').replace('Cloudgate could not deliver this email. Check the tenant email configuration and retry.','Email delivery failed. Check the SMTP selectors and retry.')
        p.write_text(smtp+'\n'+s,encoding='utf8')
        p=root/'deploy.py';s=p.read_text(encoding='utf8');s='from workflow_inputs import bind_inputs\n'+s
        s=s.replace('    return text\n\n\ndef base_node','    return bind_inputs(text) if with_lib or libraries else text\n\n\ndef base_node');p.write_text(s,encoding='utf8')
        p=root/'package_refunds.py';s=p.read_text(encoding='utf8').replace("template = bundle['Projects'][0]['Template']","template = bundle['Projects'][0]['Template']\n    template['Keys'] = json.loads((ROOT/'email-selectors.json').read_text(encoding='utf8'))");p.write_text(s,encoding='utf8')
    else:
        p=root/'package.py';s=p.read_text(encoding='utf8');s='from workflow_inputs import bind_inputs\n'+s
        s=s.replace('BRIDGE','INPUT_HELPERS').replace('import cloudgate\n','')
        start=s.index('def value(');end=s.index('\ndef obj',start)
        s=s[:start]+"def value(name):\n    return _inputs.get(name, '')\n\n"+s[end:]
        s=s.replace("return INPUT_HELPERS+'\\n'+(ENGINE+'\\n' if engine else '')+code","return bind_inputs(INPUT_HELPERS+'\\n'+(ENGINE+'\\n' if engine else '')+code)")
        s=s.replace("mail=(ROOT/'notifications.py').read_text(encoding='utf8')","mail=(ROOT/'smtp_email.py').read_text(encoding='utf8')+'\\n'+(ROOT/'notifications.py').read_text(encoding='utf8')")
        s=s.replace("mail_script=(ROOT/'notifications.py').read_text()","mail_script=(ROOT/'smtp_email.py').read_text(encoding='utf8')+'\\n'+(ROOT/'notifications.py').read_text(encoding='utf8')")
        s=s.replace('Keys=[]',"Keys=json.loads((ROOT/'email-selectors.json').read_text(encoding='utf8'))").replace("'Keys':[]","'Keys':json.loads((ROOT/'email-selectors.json').read_text(encoding='utf8'))")
        s=s.replace('The only substituted Python literal is the platform-owned session id.','Inputs use ordinary workflow selectors bound as data by the Python runtime.')
        p.write_text(s,encoding='utf8')
        p=root/'notifications.py';s=p.read_text(encoding='utf8').replace('            import cloudgate\n','').replace('    import cloudgate\n','').replace('cloudgate.send_app_email','send_email').replace('through the tenant-scoped Python runner API','with Python standard-library SMTP')
        p.write_text(s,encoding='utf8')
