# Admin Settings / IsTest — route 'send-test' through the mail branch. (Condition: bool.)
return op_of(body(), 'get') == 'send-test'
