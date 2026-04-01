import { createDecipheriv, createPublicKey, createSign, createVerify, randomBytes } from 'node:crypto';
import type { OrderPayResult, OrderRefundResult, WechatMiniProgramPayParams } from '../frontend/src/types/api';
import { hasWechatPayCredential, serverConfig } from './config.ts';

interface WechatPayResourceCipher {
  algorithm: 'AEAD_AES_256_GCM';
  ciphertext: string;
  nonce: string;
  associated_data?: string;
  original_type?: string;
}

interface WechatPayNotifyEnvelope<TResource> {
  id?: string;
  create_time?: string;
  event_type?: string;
  resource_type?: string;
  summary?: string;
  resource?: WechatPayResourceCipher;
  decrypted?: TResource;
}

export interface WechatPayTransactionResource {
  appid: string;
  mchid: string;
  out_trade_no: string;
  transaction_id: string;
  trade_state: string;
  success_time?: string;
  amount?: {
    total: number;
    payer_total?: number;
    currency?: string;
    payer_currency?: string;
  };
}

export interface WechatPayRefundResource {
  out_trade_no: string;
  out_refund_no: string;
  refund_id: string;
  refund_status: string;
  success_time?: string;
  amount?: {
    refund: number;
    payer_refund?: number;
    total: number;
    payer_total?: number;
    currency?: string;
  };
}

export interface WechatPayNotificationHeaders {
  timestamp: string;
  nonce: string;
  signature: string;
  serial: string;
}

interface WechatPayUnifiedOrderResponse {
  prepay_id: string;
}

interface WechatPayRefundResponse {
  refund_id?: string;
  out_refund_no?: string;
  status?: string;
}

function ensureWechatPayConfigured() {
  if (!hasWechatPayCredential()) {
    throw new Error('wechat_pay_not_configured');
  }

  if (serverConfig.wechatPay.apiV3Key.length !== 32) {
    throw new Error('wechat_pay_not_configured');
  }
}

export function canUseRealWechatPay() {
  return hasWechatPayCredential() && serverConfig.wechatPay.apiV3Key.length === 32;
}

export function shouldUseRealWechatPay() {
  if (serverConfig.wechatPay.mode === 'mock') {
    return false;
  }

  if (serverConfig.wechatPay.mode === 'real') {
    ensureWechatPayConfigured();
    return true;
  }

  return canUseRealWechatPay();
}

function buildNonce(size = 16) {
  return randomBytes(size).toString('hex');
}

function signMessage(message: string) {
  ensureWechatPayConfigured();
  const sign = createSign('RSA-SHA256');
  sign.update(message);
  sign.end();
  return sign.sign(serverConfig.wechatPay.privateKey, 'base64');
}

function verifyMessage(message: string, signature: string) {
  ensureWechatPayConfigured();
  const verifier = createVerify('RSA-SHA256');
  verifier.update(message);
  verifier.end();

  const publicKeySource = serverConfig.wechatPay.platformPublicKey || serverConfig.wechatPay.platformCert;
  const publicKey = createPublicKey(publicKeySource);
  return verifier.verify(publicKey, signature, 'base64');
}

function buildAuthorization(method: string, path: string, body: string, timestamp: string, nonce: string) {
  const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = signMessage(message);
  return `WECHATPAY2-SHA256-RSA2048 mchid="${serverConfig.wechatPay.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${serverConfig.wechatPay.serialNo}",signature="${signature}"`;
}

async function requestWechatPay<T>(method: 'POST' | 'GET', path: string, payload?: Record<string, unknown>) {
  ensureWechatPayConfigured();
  const body = payload ? JSON.stringify(payload) : '';
  const nonce = buildNonce();
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const response = await fetch(`https://api.mch.weixin.qq.com${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: buildAuthorization(method, path, body, timestamp, nonce),
      'User-Agent': 'campus-growth-api/1.0',
    },
    body: method === 'GET' ? undefined : body,
    signal: AbortSignal.timeout(10000),
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T & { message?: string; code?: string }) : ({} as T);

  if (!response.ok) {
    const errorText =
      typeof data === 'object' && data
        ? `${(data as { code?: string }).code || response.status}:${(data as { message?: string }).message || text}`
        : `${response.status}:${text}`;
    throw new Error(`wechat_pay_request_failed:${errorText}`);
  }

  return data;
}

function toFen(amount: number) {
  return Math.round(amount * 100);
}

export async function createWechatJsapiPayment(params: {
  orderId: string;
  description: string;
  amount: number;
  openId: string;
}): Promise<OrderPayResult> {
  const notifyUrl = serverConfig.wechatPay.notifyUrl;
  const payload = {
    appid: serverConfig.wechatPay.appId,
    mchid: serverConfig.wechatPay.mchId,
    description: params.description,
    out_trade_no: params.orderId,
    notify_url: notifyUrl,
    amount: {
      total: toFen(params.amount),
      currency: 'CNY',
    },
    payer: {
      openid: params.openId,
    },
  };

  const response = await requestWechatPay<WechatPayUnifiedOrderResponse>(
    'POST',
    '/v3/pay/transactions/jsapi',
    payload
  );

  const timeStamp = `${Math.floor(Date.now() / 1000)}`;
  const nonceStr = buildNonce();
  const packageValue = `prepay_id=${response.prepay_id}`;
  const paySign = signMessage(
    `${serverConfig.wechatPay.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`
  );

  const paymentParams: WechatMiniProgramPayParams = {
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: 'RSA',
    paySign,
  };

  return {
    orderId: params.orderId,
    status: '待支付',
    paymentMode: 'wechat_pay_v3',
    paymentParams,
  };
}

export async function createWechatRefund(params: {
  orderId: string;
  refundId: string;
  amount: number;
  reason?: string;
}): Promise<OrderRefundResult> {
  const response = await requestWechatPay<WechatPayRefundResponse>(
    'POST',
    '/v3/refund/domestic/refunds',
    {
      out_trade_no: params.orderId,
      out_refund_no: params.refundId,
      notify_url: serverConfig.wechatPay.refundNotifyUrl,
      reason: params.reason || '用户发起退款申请',
      amount: {
        refund: toFen(params.amount),
        total: toFen(params.amount),
        currency: 'CNY',
      },
    }
  );

  return {
    orderId: params.orderId,
    status: response.status === 'SUCCESS' ? '已退款' : '退款中',
    refundMode: 'wechat_pay_v3',
    refundId: response.refund_id || response.out_refund_no || params.refundId,
  };
}

function decryptResource(resource: WechatPayResourceCipher) {
  ensureWechatPayConfigured();
  const ciphertext = Buffer.from(resource.ciphertext, 'base64');
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(serverConfig.wechatPay.apiV3Key, 'utf8'),
    Buffer.from(resource.nonce, 'utf8')
  );

  if (resource.associated_data) {
    decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
  }

  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString('utf8');
}

export function normalizeWechatPayHeaders(input: Record<string, string | undefined>): WechatPayNotificationHeaders {
  return {
    timestamp: input['wechatpay-timestamp'] || input['Wechatpay-Timestamp'] || '',
    nonce: input['wechatpay-nonce'] || input['Wechatpay-Nonce'] || '',
    signature: input['wechatpay-signature'] || input['Wechatpay-Signature'] || '',
    serial: input['wechatpay-serial'] || input['Wechatpay-Serial'] || '',
  };
}

function verifyNotificationHeaders(headers: WechatPayNotificationHeaders, rawBody: string) {
  ensureWechatPayConfigured();

  if (
    !headers.timestamp ||
    !headers.nonce ||
    !headers.signature ||
    !headers.serial
  ) {
    throw new Error('payment_signature_invalid');
  }

  if (serverConfig.wechatPay.platformSerial && headers.serial !== serverConfig.wechatPay.platformSerial) {
    throw new Error('payment_signature_invalid');
  }

  const message = `${headers.timestamp}\n${headers.nonce}\n${rawBody}\n`;
  if (!verifyMessage(message, headers.signature)) {
    throw new Error('payment_signature_invalid');
  }
}

export function parseWechatTransactionNotification(
  rawBody: string,
  headers: WechatPayNotificationHeaders
) {
  verifyNotificationHeaders(headers, rawBody);
  const envelope = JSON.parse(rawBody) as WechatPayNotifyEnvelope<WechatPayTransactionResource>;
  if (!envelope.resource) {
    throw new Error('payment_notify_invalid');
  }

  return {
    ...envelope,
    decrypted: JSON.parse(decryptResource(envelope.resource)) as WechatPayTransactionResource,
  };
}

export function parseWechatRefundNotification(
  rawBody: string,
  headers: WechatPayNotificationHeaders
) {
  verifyNotificationHeaders(headers, rawBody);
  const envelope = JSON.parse(rawBody) as WechatPayNotifyEnvelope<WechatPayRefundResource>;
  if (!envelope.resource) {
    throw new Error('payment_notify_invalid');
  }

  return {
    ...envelope,
    decrypted: JSON.parse(decryptResource(envelope.resource)) as WechatPayRefundResource,
  };
}
