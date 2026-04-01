import { createHash } from 'node:crypto';
import { hasWechatCredential, serverConfig } from './config.ts';

interface WechatCode2SessionResponse {
  session_key?: string;
  openid?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

export interface WechatLoginIdentity {
  openId: string;
  unionId?: string | null;
  sessionKey?: string | null;
  providerMode: 'real' | 'mock';
}

function buildMockIdentity(code: string): WechatLoginIdentity {
  if (code === 'demo-code') {
    return {
      openId: 'mock:u1',
      unionId: null,
      sessionKey: null,
      providerMode: 'mock',
    };
  }

  const digest = createHash('sha256').update(code || 'demo-code').digest('hex').slice(0, 20);
  return {
    openId: `mock-${digest}`,
    unionId: null,
    sessionKey: null,
    providerMode: 'mock',
  };
}

async function requestCode2Session(code: string): Promise<WechatCode2SessionResponse> {
  const query = new URLSearchParams({
    appid: serverConfig.wechat.appId,
    secret: serverConfig.wechat.appSecret,
    js_code: code,
    grant_type: 'authorization_code',
  });

  const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query.toString()}`, {
    method: 'GET',
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`wechat_login_http_${response.status}`);
  }

  return (await response.json()) as WechatCode2SessionResponse;
}

export async function resolveWechatIdentity(code: string): Promise<WechatLoginIdentity> {
  const mode = serverConfig.wechat.loginMode;
  const canUseWechat = hasWechatCredential() && code !== 'demo-code';

  if (mode === 'mock' || !canUseWechat) {
    if (mode === 'real' && !canUseWechat) {
      throw new Error('wechat_login_not_configured');
    }

    return buildMockIdentity(code);
  }

  try {
    const payload = await requestCode2Session(code);

    if (!payload.openid || !payload.session_key) {
      throw new Error(payload.errmsg || 'wechat_login_failed');
    }

    return {
      openId: payload.openid,
      unionId: payload.unionid || null,
      sessionKey: payload.session_key,
      providerMode: 'real',
    };
  } catch (error) {
    if (mode === 'real') {
      throw error;
    }

    return buildMockIdentity(code);
  }
}
