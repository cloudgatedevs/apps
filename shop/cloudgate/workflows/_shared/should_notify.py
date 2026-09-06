# Shared / ShouldNotify — publish only when NotifyBody produced an event. (Condition: bool.)
return bool(str('''${NotifyBody}''').strip())
