# Admin Inventory / ShouldNotifyStock — publish only when StockEvent produced an event. (Condition: bool.)
return bool(str('''${StockEvent}''').strip())
