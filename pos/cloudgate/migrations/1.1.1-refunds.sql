-- Durable refund requests. Safe to apply to existing sandbox/production databases.
CREATE TABLE IF NOT EXISTS refund_requests (
 Id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
 RequestKey TEXT NOT NULL UNIQUE,
 BusinessId INTEGER NOT NULL,
 Method TEXT NOT NULL CHECK(Method IN ('card','cash')),
 AmountCents INTEGER NOT NULL CHECK(AmountCents > 0 OR (AmountCents=0 AND Status='failed')),
 Currency TEXT NOT NULL,
 PaymentRowId INTEGER,
 PaymentId INTEGER,
 IntentJson TEXT NOT NULL CHECK(json_valid(IntentJson)),
 LinesJson TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(LinesJson)),
 SnapshotRefunded INTEGER NOT NULL,
 Status TEXT NOT NULL DEFAULT 'submitting' CHECK(Status IN ('submitting','pending','succeeded','failed','reconciliation_required')),
 ProviderRefundId TEXT,
 Applied INTEGER NOT NULL DEFAULT 0,
 ShiftId INTEGER,
 CreatedBy TEXT,
 RawJson TEXT,
 CreatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UpdatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_refund_unresolved ON refund_requests(BusinessId) WHERE Status NOT IN ('succeeded','failed');
CREATE UNIQUE INDEX IF NOT EXISTS ux_refund_provider ON refund_requests(PaymentId,ProviderRefundId) WHERE ProviderRefundId IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_refund_business ON refund_requests(BusinessId,Id);
CREATE TRIGGER IF NOT EXISTS refund_key_guard BEFORE INSERT ON refund_requests
WHEN EXISTS(SELECT 1 FROM refund_requests WHERE RequestKey=NEW.RequestKey AND (BusinessId<>NEW.BusinessId OR IntentJson<>NEW.IntentJson))
BEGIN SELECT RAISE(ROLLBACK,'Refund request key is already bound to different details.'); END;

CREATE TRIGGER IF NOT EXISTS refund_claim_guard BEFORE INSERT ON refund_requests
WHEN NEW.Status<>'failed' AND NOT EXISTS(SELECT 1 FROM refund_requests WHERE RequestKey=NEW.RequestKey)
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sales WHERE Id=NEW.BusinessId AND Status IN ('completed','partially_refunded')
 AND RefundedCents=NEW.SnapshotRefunded AND NEW.AmountCents<=TotalCents-RefundedCents AND upper(Currency)=NEW.Currency)
 THEN RAISE(ROLLBACK,'Sale balance changed. Reload the sale before refunding.') END;
 SELECT CASE WHEN NEW.AmountCents>(SELECT COALESCE(SUM(AmountCents),0) FROM sale_payments WHERE SaleId=NEW.BusinessId AND Method=NEW.Method AND Status='succeeded')
 -(SELECT COALESCE(SUM(AmountCents),0) FROM refunds WHERE SaleId=NEW.BusinessId AND Method=NEW.Method AND Status='completed')
 THEN RAISE(ROLLBACK,'Refund exceeds the amount paid by this method.') END;
 SELECT CASE WHEN NEW.Method='card' AND NOT EXISTS(SELECT 1 FROM sale_payments WHERE Id=NEW.PaymentRowId AND SaleId=NEW.BusinessId AND ConnectPaymentId=NEW.PaymentId AND Method='card' AND Status='succeeded' AND AmountCents>=NEW.AmountCents)
 THEN RAISE(ROLLBACK,'Original card payment is not refundable.') END;
 SELECT CASE WHEN json_array_length(NEW.LinesJson)=0 OR EXISTS(SELECT 1 FROM json_each(NEW.LinesJson) l LEFT JOIN sale_items i ON i.Id=json_extract(l.value,'$.saleItemId')
 WHERE i.Id IS NULL OR i.SaleId<>NEW.BusinessId OR abs(i.RefundedQty-json_extract(l.value,'$.expectedRefundedQty'))>0.000000001
 OR json_extract(l.value,'$.qty')<=0 OR json_extract(l.value,'$.qty')>i.Qty-i.RefundedQty+0.000000001)
 THEN RAISE(ROLLBACK,'Returned quantities changed. Reload the sale.') END;
 SELECT CASE WHEN NEW.ShiftId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM shifts WHERE Id=NEW.ShiftId AND Status='open')
 THEN RAISE(ROLLBACK,'The cash refund shift has closed.') END;
END;
CREATE TRIGGER IF NOT EXISTS refund_apply AFTER UPDATE OF Status ON refund_requests
WHEN NEW.Status='succeeded' AND OLD.Applied=0 AND OLD.Status<>'succeeded'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sales WHERE Id=NEW.BusinessId AND RefundedCents=NEW.SnapshotRefunded)
 THEN RAISE(ROLLBACK,'Refund needs reconciliation: local sale balance changed.') END;
 INSERT INTO refunds(SaleId,Reference,Method,AmountCents,Reason,ItemsJson,ConnectRefundId,ShiftId,CreatedBy)
 VALUES(NEW.BusinessId,(SELECT Reference FROM sales WHERE Id=NEW.BusinessId)||'-RF-'||NEW.Id,NEW.Method,NEW.AmountCents,json_extract(NEW.IntentJson,'$.reason'),NEW.LinesJson,NEW.ProviderRefundId,NEW.ShiftId,NEW.CreatedBy);
 UPDATE sale_items SET RefundedQty=RefundedQty+(SELECT json_extract(value,'$.qty') FROM json_each(NEW.LinesJson) WHERE json_extract(value,'$.saleItemId')=sale_items.Id)
 WHERE Id IN (SELECT json_extract(value,'$.saleItemId') FROM json_each(NEW.LinesJson));
 UPDATE products SET StockQty=StockQty+(SELECT SUM(json_extract(value,'$.qty')) FROM json_each(NEW.LinesJson) WHERE json_extract(value,'$.productId')=products.Id),UpdatedAt=CURRENT_TIMESTAMP
 WHERE Id IN (SELECT json_extract(value,'$.productId') FROM json_each(NEW.LinesJson)) AND TrackInventory=1;
 INSERT INTO inventory_movements(ProductId,Delta,Reason,Reference,Note,CreatedBy)
 SELECT p.Id,json_extract(l.value,'$.qty'),'refund',(SELECT Reference FROM sales WHERE Id=NEW.BusinessId),'Confirmed refund '||NEW.RequestKey,NEW.CreatedBy
 FROM json_each(NEW.LinesJson) l JOIN products p ON p.Id=json_extract(l.value,'$.productId') WHERE p.TrackInventory=1;
 UPDATE sales SET RefundedCents=RefundedCents+NEW.AmountCents,
 Status=CASE WHEN RefundedCents+NEW.AmountCents>=TotalCents THEN 'refunded' ELSE 'partially_refunded' END,UpdatedAt=CURRENT_TIMESTAMP WHERE Id=NEW.BusinessId;
 INSERT INTO sale_events(SaleId,Type,Message,DataJson,CreatedBy)
 VALUES(NEW.BusinessId,'refund',NEW.Method||' refund confirmed',json_object('requestKey',NEW.RequestKey,'refundId',NEW.ProviderRefundId,'reason',json_extract(NEW.IntentJson,'$.reason')),NEW.CreatedBy);
 UPDATE refund_requests SET Applied=1,UpdatedAt=CURRENT_TIMESTAMP WHERE Id=NEW.Id;
END;
