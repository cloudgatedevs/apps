"""SMTP delivery using only the Python standard library.
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
