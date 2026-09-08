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
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM payments p JOIN orders o ON o.Id=p.OrderId WHERE p.Id=NEW.PaymentRowId
 AND p.OrderId=NEW.BusinessId AND p.ConnectPaymentId=NEW.PaymentId AND NEW.Method='card'
 AND p.Status IN ('succeeded','partially_refunded') AND COALESCE(p.RefundedCents,0)=NEW.SnapshotRefunded
 AND NEW.AmountCents<=p.AmountCents-COALESCE(p.RefundedCents,0) AND upper(o.Currency)=NEW.Currency)
 THEN RAISE(ROLLBACK,'Payment balance changed. Reload the order before refunding.') END;
END;
CREATE TRIGGER IF NOT EXISTS refund_apply AFTER UPDATE OF Status ON refund_requests
WHEN NEW.Status='succeeded' AND OLD.Applied=0 AND OLD.Status<>'succeeded'
BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM payments WHERE Id=NEW.PaymentRowId AND COALESCE(RefundedCents,0)=NEW.SnapshotRefunded)
 THEN RAISE(ROLLBACK,'Refund needs reconciliation: local payment balance changed.') END;
 UPDATE payments SET RefundedCents=COALESCE(RefundedCents,0)+NEW.AmountCents,
 Status=CASE WHEN COALESCE(RefundedCents,0)+NEW.AmountCents>=AmountCents THEN 'refunded' ELSE 'partially_refunded' END,
 RawJson=NEW.RawJson,UpdatedAt=CURRENT_TIMESTAMP WHERE Id=NEW.PaymentRowId;
 UPDATE orders SET PaymentStatus=(SELECT Status FROM payments WHERE Id=NEW.PaymentRowId),
 Status=CASE WHEN (SELECT Status FROM payments WHERE Id=NEW.PaymentRowId)='refunded' THEN 'refunded' ELSE Status END,
 UpdatedAt=CURRENT_TIMESTAMP WHERE Id=NEW.BusinessId;
 UPDATE product_variants SET StockQty=StockQty+(SELECT COALESCE(SUM(Qty),0) FROM order_items WHERE OrderId=NEW.BusinessId AND VariantId=product_variants.Id),UpdatedAt=CURRENT_TIMESTAMP
 WHERE Id IN (SELECT VariantId FROM order_items WHERE OrderId=NEW.BusinessId)
 AND EXISTS(SELECT 1 FROM products p WHERE p.Id=product_variants.ProductId AND p.TrackInventory=1)
 AND json_extract(NEW.IntentJson,'$.restock')=1
 AND NOT EXISTS(SELECT 1 FROM inventory_movements WHERE Reference=(SELECT Reference FROM orders WHERE Id=NEW.BusinessId) AND Reason='refund');
 INSERT INTO inventory_movements(VariantId,ProductId,Delta,Reason,Reference,Note,CreatedBy)
 SELECT i.VariantId,i.ProductId,i.Qty,'refund',o.Reference,'Restocked on confirmed refund',NEW.CreatedBy
 FROM order_items i JOIN products p ON p.Id=i.ProductId JOIN orders o ON o.Id=i.OrderId
 WHERE i.OrderId=NEW.BusinessId AND p.TrackInventory=1 AND json_extract(NEW.IntentJson,'$.restock')=1
 AND NOT EXISTS(SELECT 1 FROM inventory_movements WHERE Reference=o.Reference AND Reason='refund');
 INSERT INTO order_events(OrderId,Type,Message,DataJson,CreatedBy)
 VALUES(NEW.BusinessId,'refund','Confirmed refund: '||NEW.AmountCents||' cents',json_object('requestKey',NEW.RequestKey,'refundId',NEW.ProviderRefundId,'reason',json_extract(NEW.IntentJson,'$.reason')),NEW.CreatedBy);
 UPDATE refund_requests SET Applied=1,UpdatedAt=CURRENT_TIMESTAMP WHERE Id=NEW.Id;
END;
