import type { OrderPayResult, OrderRefundPayload, OrderRefundResult } from '../frontend/src/types/api';
import type { PaymentNotifyPayload, PaymentNotifyResult, RefundRow, ResourceDownloadResult } from './models.ts';
import { serverConfig } from './config.ts';
import {
  canUseRealWechatPay,
  createWechatJsapiPayment,
  createWechatRefund,
  normalizeWechatPayHeaders,
  parseWechatRefundNotification,
  parseWechatTransactionNotification,
  shouldUseRealWechatPay,
} from './wechat-pay.ts';
import {
  createId,
  createOrUpdateOwnedResource,
  ensureDownloadGrant,
  formatDateTime,
  getDownloadGrantRow,
  getOne,
  nowIso,
  pushNotification,
  run,
} from './helpers.ts';
import { getResourceDetail } from './catalog-service.ts';
import type { OrderRow, OwnedResourceRow, ResourceAssetRow, UserRow } from './models.ts';
import { readResourceAssetContent } from './storage-service.ts';

interface OrderRecord extends OrderRow {
  payment_ref?: string | null;
}

interface DownloadFilePayload {
  filename: string;
  content: Buffer | string;
  contentType: string;
}

const mockRefundTimers = new Map<string, ReturnType<typeof setTimeout>>();

function getOrderRow(orderId: string) {
  const order = getOne<OrderRecord>(
    `
      SELECT id, user_id, title, item_type, amount, status, created_at, paid_at, resource_id, cover_label, payment_ref
      FROM orders
      WHERE id = @orderId
    `,
    { orderId }
  );

  if (!order) {
    throw new Error('order_not_found');
  }

  return order;
}

function getOrderForUser(userId: string, orderId: string) {
  const order = getOrderRow(orderId);
  if (order.user_id !== userId) {
    throw new Error('order_not_found');
  }

  return order;
}

function getUserOpenId(userId: string) {
  const user = getOne<UserRow>(
    `
      SELECT id, open_id, union_id, session_key, name, mark, avatar_url, school, major, grade, bio, focus_tags_json
      FROM users
      WHERE id = @userId
    `,
    { userId }
  );

  if (!user) {
    throw new Error('user_not_found');
  }

  return user.open_id;
}

function createRefundRecord(params: {
  orderId: string;
  outRefundNo: string;
  amount: number;
  reason?: string;
  status: RefundRow['status'];
  refundId?: string | null;
  payloadJson?: string | null;
}) {
  run(
    `
      INSERT INTO refunds (
        id, order_id, out_refund_no, refund_id, amount, reason, status, payload_json, created_at, updated_at
      ) VALUES (
        @id, @orderId, @outRefundNo, @refundId, @amount, @reason, @status, @payloadJson, @createdAt, @updatedAt
      )
    `,
    {
      id: createId('refund'),
      orderId: params.orderId,
      outRefundNo: params.outRefundNo,
      refundId: params.refundId || null,
      amount: params.amount,
      reason: params.reason || null,
      status: params.status,
      payloadJson: params.payloadJson || null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
  );
}

function updateRefundRecordByOutRefundNo(
  outRefundNo: string,
  patch: {
    status: RefundRow['status'];
    refundId?: string | null;
    payloadJson?: string | null;
  }
) {
  run(
    `
      UPDATE refunds
      SET status = @status,
          refund_id = COALESCE(@refundId, refund_id),
          payload_json = COALESCE(@payloadJson, payload_json),
          updated_at = @updatedAt
      WHERE out_refund_no = @outRefundNo
    `,
    {
      status: patch.status,
      refundId: patch.refundId || null,
      payloadJson: patch.payloadJson || null,
      updatedAt: nowIso(),
      outRefundNo,
    }
  );
}

function finalizeOrderPaid(order: OrderRecord, transactionId?: string | null, payloadJson?: string | null) {
  const resource = order.resource_id ? getResourceDetail(order.resource_id, order.user_id) : null;
  let ownedResourceCreated = false;

  run(
    `
      UPDATE orders
      SET status = '已完成',
          paid_at = @paidAt,
          payment_ref = COALESCE(@paymentRef, payment_ref),
          notify_payload_json = COALESCE(@notifyPayloadJson, notify_payload_json),
          updated_at = @updatedAt
      WHERE id = @orderId
    `,
    {
      paidAt: formatDateTime(),
      paymentRef: transactionId || null,
      notifyPayloadJson: payloadJson || null,
      updatedAt: nowIso(),
      orderId: order.id,
    }
  );

  if (resource) {
    const owned = getOne<{ id: string }>(
      `SELECT id FROM owned_resources WHERE user_id = @userId AND resource_id = @resourceId`,
      { userId: order.user_id, resourceId: resource.id }
    );

    if (!owned) {
      createOrUpdateOwnedResource(order.user_id, resource, 'paid');
      ensureDownloadGrant(order.user_id, resource.id, 'paid', order.id);
      ownedResourceCreated = true;
    }
  }

  pushNotification(order.user_id, {
    category: '订单',
    title: '订单支付已完成',
    content: `订单《${order.title}》已支付成功，资源权限会自动同步到账户。`,
    linkType: resource ? 'resource' : 'post',
    linkId: resource?.id,
    ctaText: resource ? '查看资源' : '查看订单',
  });

  return {
    orderId: order.id,
    status: '已完成' as const,
    ownedResourceCreated,
  };
}

function markOrderRefundProcessing(order: OrderRecord, payloadJson?: string | null) {
  run(
    `
      UPDATE orders
      SET status = '退款中',
          notify_payload_json = COALESCE(@notifyPayloadJson, notify_payload_json),
          updated_at = @updatedAt
      WHERE id = @orderId
    `,
    {
      notifyPayloadJson: payloadJson || null,
      updatedAt: nowIso(),
      orderId: order.id,
    }
  );
}

function notifyOrderRefundProcessing(order: OrderRecord) {
  pushNotification(order.user_id, {
    category: '订单',
    title: '退款申请已提交',
    content: `订单《${order.title}》已经进入退款处理流程，进度会继续在消息中心和退款结果页同步。`,
    linkType: 'order',
    linkId: order.id,
    linkScene: 'refund_result',
    ctaText: '查看退款进度',
  });
}

function finalizeOrderRefunded(order: OrderRecord, refundId?: string | null, payloadJson?: string | null) {
  const refundMode: OrderRefundResult['refundMode'] = shouldUseRealWechatPay() ? 'wechat_pay_v3' : 'mock';

  run(
    `
      UPDATE orders
      SET status = '已退款',
          notify_payload_json = COALESCE(@notifyPayloadJson, notify_payload_json),
          updated_at = @updatedAt
      WHERE id = @orderId
    `,
    {
      notifyPayloadJson: payloadJson || null,
      updatedAt: nowIso(),
      orderId: order.id,
    }
  );

  if (order.resource_id) {
    run(
      `DELETE FROM resource_download_grants WHERE user_id = @userId AND resource_id = @resourceId`,
      { userId: order.user_id, resourceId: order.resource_id }
    );
    run(
      `DELETE FROM owned_resources WHERE user_id = @userId AND resource_id = @resourceId`,
      { userId: order.user_id, resourceId: order.resource_id }
    );
  }

  if (refundId) {
    run(`UPDATE refunds SET refund_id = @refundId, updated_at = @updatedAt WHERE order_id = @orderId`, {
      refundId,
      updatedAt: nowIso(),
      orderId: order.id,
    });
  }

  pushNotification(order.user_id, {
    category: '订单',
    title: '退款已完成',
    content: `订单《${order.title}》已完成退款，相关资源权限也会同步回收。`,
    linkType: 'order',
    linkId: order.id,
    linkScene: 'refund_result',
    ctaText: '查看退款结果',
  });

  return {
    orderId: order.id,
    status: '已退款' as const,
    refundMode,
    refundId: refundId || undefined,
  };
}

function scheduleMockRefundCompletion(order: OrderRecord, outRefundNo: string) {
  const existing = mockRefundTimers.get(order.id);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    try {
      updateRefundRecordByOutRefundNo(outRefundNo, {
        status: 'success',
        refundId: outRefundNo,
        payloadJson: JSON.stringify({ mode: 'mock_async', outRefundNo }),
      });
      finalizeOrderRefunded(order, outRefundNo, JSON.stringify({ mode: 'mock_async', outRefundNo }));
    } finally {
      mockRefundTimers.delete(order.id);
    }
  }, 3500);

  mockRefundTimers.set(order.id, timer);
}

function getResourceAssetForDownload(resourceId: string) {
  return getOne<ResourceAssetRow>(
    `
      SELECT ra.id, ra.user_id, ra.storage_provider, ra.storage_key, ra.local_path, ra.original_name, ra.file_name, ra.content_type, ra.size_bytes, ra.created_at
      FROM resources r
      JOIN resource_assets ra ON ra.id = r.file_asset_id
      WHERE r.id = @resourceId
    `,
    { resourceId }
  );
}

export function createResourceDownload(userId: string, resourceId: string): ResourceDownloadResult {
  const resource = getResourceDetail(resourceId, userId);
  const asset = getResourceAssetForDownload(resourceId);
  if (!asset) {
    throw new Error('resource_file_missing');
  }

  const accessStatus = resource.viewer?.accessStatus ?? 'not_acquired';

  if (accessStatus !== 'owned') {
    throw new Error(accessStatus === 'pending_payment' ? 'resource_payment_pending' : 'resource_not_owned');
  }

  const owned = getOne<OwnedResourceRow>(
    `
      SELECT id, user_id, resource_id, title, type, access_type, acquired_at, download_count, tags_json
      FROM owned_resources
      WHERE user_id = @userId AND resource_id = @resourceId
    `,
    { userId, resourceId }
  );

  if (!owned) {
    throw new Error('resource_not_owned');
  }

  const grant = ensureDownloadGrant(userId, resourceId, owned.access_type);
  run(`UPDATE owned_resources SET download_count = download_count + 1 WHERE id = @id`, { id: owned.id });

  return {
    grantId: grant.grantId,
    downloadUrl: grant.downloadUrl,
    expiresAt: grant.expiresAt,
    filename: asset.original_name,
  };
}

export function getDownloadGrant(userId: string, grantId: string): ResourceDownloadResult {
  const grant = getDownloadGrantRow(grantId, userId);
  const resource = getResourceDetail(grant.resource_id, userId);
  const asset = getResourceAssetForDownload(grant.resource_id);
  return {
    grantId: grant.id,
    downloadUrl: grant.download_url,
    expiresAt: grant.expires_at,
    filename: asset?.original_name || `${resource.title}.txt`,
  };
}

export async function getDownloadFilePayload(userId: string, grantId: string): Promise<DownloadFilePayload> {
  const grant = getDownloadGrantRow(grantId, userId);
  getResourceDetail(grant.resource_id, userId);
  const asset = getResourceAssetForDownload(grant.resource_id);

  if (asset) {
    const file = await readResourceAssetContent(asset.id);
    return {
      filename: asset.original_name,
      contentType: asset.content_type,
      content: file.content,
    };
  }

  throw new Error('resource_file_missing');
}

export async function createOrderPayment(userId: string, orderId: string): Promise<OrderPayResult> {
  if (!serverConfig.paymentsEnabled) {
    throw new Error('payments_disabled');
  }

  const order = getOrderForUser(userId, orderId);

  if (order.status === '已完成') {
    return {
      orderId: order.id,
      status: order.status,
      paymentMode: canUseRealWechatPay() ? 'wechat_pay_v3' : 'mock',
    };
  }

  if (order.status === '退款中' || order.status === '已退款') {
    throw new Error('order_not_payable');
  }

  if (!shouldUseRealWechatPay()) {
    const result = finalizeOrderPaid(order, `mock_txn_${Date.now()}`, JSON.stringify({ mode: 'mock' }));
    return {
      orderId: result.orderId,
      status: result.status,
      paymentMode: 'mock',
    };
  }

  const openId = getUserOpenId(userId);
  return createWechatJsapiPayment({
    orderId: order.id,
    description: order.title,
    amount: order.amount,
    openId,
  });
}

export async function createOrderRefund(
  userId: string,
  orderId: string,
  payload: OrderRefundPayload = {}
): Promise<OrderRefundResult> {
  if (!serverConfig.paymentsEnabled) {
    throw new Error('payments_disabled');
  }

  const order = getOrderForUser(userId, orderId);
  const refundMode: OrderRefundResult['refundMode'] = shouldUseRealWechatPay() ? 'wechat_pay_v3' : 'mock';

  if (order.status === '已退款') {
    return {
      orderId: order.id,
      status: order.status,
      refundMode,
    };
  }

  if (order.status === '退款中') {
    return {
      orderId: order.id,
      status: order.status,
      refundMode,
    };
  }

  if (order.status !== '已完成') {
    throw new Error('refund_not_available');
  }

  const outRefundNo = createId('refund');

  if (!shouldUseRealWechatPay()) {
    createRefundRecord({
      orderId: order.id,
      outRefundNo,
      amount: order.amount,
      reason: payload.reason,
      status: 'processing',
      payloadJson: JSON.stringify({ mode: 'mock_async', outRefundNo }),
    });
    markOrderRefundProcessing(order, JSON.stringify({ mode: 'mock_async', outRefundNo }));
    notifyOrderRefundProcessing(order);
    scheduleMockRefundCompletion(order, outRefundNo);
    return {
      orderId: order.id,
      status: '退款中',
      refundMode: 'mock',
      refundId: outRefundNo,
    };
  }

  createRefundRecord({
    orderId: order.id,
    outRefundNo,
    amount: order.amount,
    reason: payload.reason,
    status: 'processing',
  });

  let refund: OrderRefundResult;
  try {
    refund = await createWechatRefund({
      orderId: order.id,
      refundId: outRefundNo,
      amount: order.amount,
      reason: payload.reason,
    });
  } catch (error) {
    updateRefundRecordByOutRefundNo(outRefundNo, {
      status: 'abnormal',
      payloadJson: JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
    });
    throw error;
  }

  if (refund.status === '已退款') {
    updateRefundRecordByOutRefundNo(outRefundNo, {
      status: 'success',
      refundId: refund.refundId || null,
      payloadJson: JSON.stringify(refund),
    });
    return finalizeOrderRefunded(order, refund.refundId || outRefundNo, JSON.stringify(refund));
  }

  updateRefundRecordByOutRefundNo(outRefundNo, {
    status: 'processing',
    refundId: refund.refundId || null,
    payloadJson: JSON.stringify(refund),
  });
  markOrderRefundProcessing(order, JSON.stringify(refund));
  notifyOrderRefundProcessing(order);

  return {
    orderId: order.id,
    status: '退款中',
    refundMode: 'wechat_pay_v3',
    refundId: refund.refundId,
  };
}

export function handleWechatPaymentNotify(payload: PaymentNotifyPayload, signature = ''): PaymentNotifyResult {
  if (serverConfig.paymentNotifySecret && signature !== serverConfig.paymentNotifySecret) {
    throw new Error('payment_signature_invalid');
  }

  const order = getOrderRow(payload.orderId);

  run(
    `
      INSERT INTO payment_events (
        id, order_id, provider, transaction_id, event_type, payload_json, created_at
      ) VALUES (
        @id, @orderId, 'wechat', @transactionId, @eventType, @payloadJson, @createdAt
      )
    `,
    {
      id: `payevt_${Date.now()}`,
      orderId: order.id,
      transactionId: payload.transactionId || null,
      eventType: payload.status,
      payloadJson: JSON.stringify(payload.rawPayload ?? payload),
      createdAt: nowIso(),
    }
  );

  if (payload.status === 'SUCCESS') {
    return finalizeOrderPaid(
      order,
      payload.transactionId || null,
      JSON.stringify(payload.rawPayload ?? payload)
    );
  }

  if (payload.status === 'REFUND') {
    markOrderRefundProcessing(order, JSON.stringify(payload.rawPayload ?? payload));
    return {
      orderId: order.id,
      status: '退款中',
      ownedResourceCreated: false,
    };
  }

  return {
    orderId: order.id,
    status: order.status,
    ownedResourceCreated: false,
  };
}

export function handleWechatTransactionCallback(
  rawBody: string,
  headers: Record<string, string | undefined>
): PaymentNotifyResult {
  const envelope = parseWechatTransactionNotification(rawBody, normalizeWechatPayHeaders(headers));
  const transaction = envelope.decrypted;
  const order = getOrderRow(transaction.out_trade_no);

  run(
    `
      INSERT INTO payment_events (
        id, order_id, provider, transaction_id, event_type, payload_json, created_at
      ) VALUES (
        @id, @orderId, 'wechat', @transactionId, @eventType, @payloadJson, @createdAt
      )
    `,
    {
      id: `payevt_${Date.now()}`,
      orderId: order.id,
      transactionId: transaction.transaction_id,
      eventType: envelope.event_type || transaction.trade_state,
      payloadJson: JSON.stringify(envelope),
      createdAt: nowIso(),
    }
  );

  if (transaction.trade_state === 'SUCCESS') {
    return finalizeOrderPaid(order, transaction.transaction_id, JSON.stringify(envelope));
  }

  return {
    orderId: order.id,
    status: order.status,
    ownedResourceCreated: false,
  };
}

export function handleWechatRefundCallback(
  rawBody: string,
  headers: Record<string, string | undefined>
): OrderRefundResult {
  const envelope = parseWechatRefundNotification(rawBody, normalizeWechatPayHeaders(headers));
  const refund = envelope.decrypted;
  const order = getOrderRow(refund.out_trade_no);

  updateRefundRecordByOutRefundNo(refund.out_refund_no, {
    status: refund.refund_status === 'SUCCESS' ? 'success' : 'processing',
    refundId: refund.refund_id || null,
    payloadJson: JSON.stringify(envelope),
  });

  if (refund.refund_status === 'SUCCESS') {
    return finalizeOrderRefunded(order, refund.refund_id || refund.out_refund_no, JSON.stringify(envelope));
  }

  markOrderRefundProcessing(order, JSON.stringify(envelope));
  return {
    orderId: order.id,
    status: '退款中',
    refundMode: 'wechat_pay_v3',
    refundId: refund.refund_id || refund.out_refund_no,
  };
}
