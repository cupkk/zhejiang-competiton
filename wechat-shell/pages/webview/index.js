const DEFAULT_PATH = '/';
const SHELL_BUILD = '0.1.22';
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

function decodePathLayers(value) {
  let decoded = value;

  for (let index = 0; index < 8; index += 1) {
    let next;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    if (next === decoded) {
      return decoded;
    }
    decoded = next;
  }

  try {
    return decodeURIComponent(decoded) === decoded ? decoded : null;
  } catch {
    return null;
  }
}

function normalizeEntryPath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') {
    return DEFAULT_PATH;
  }

  if (rawPath !== rawPath.trim()) {
    return DEFAULT_PATH;
  }

  const decoded = decodePathLayers(rawPath);
  if (
    !decoded ||
    !decoded.startsWith('/') ||
    decoded.includes('//') ||
    decoded.includes('\\') ||
    CONTROL_CHARACTER_PATTERN.test(decoded)
  ) {
    return DEFAULT_PATH;
  }

  return decoded;
}

function buildWebUrl(origin, entryPath, code) {
  const url = `${origin}${entryPath}`;
  const separator = url.includes('?') ? '&' : '?';
  const params = [
    `mp_login_code=${encodeURIComponent(code)}`,
    `mp_entry=${encodeURIComponent(entryPath)}`,
    `mp_login_ts=${Date.now()}`,
    `mp_shell_build=${SHELL_BUILD}`,
    `mp_entry_ts=${Date.now()}`,
  ];
  return `${url}${separator}${params.join('&')}`;
}

Page({
  data: {
    loading: true,
    webUrl: '',
  },

  onLoad(options) {
    const app = getApp();
    const origin = app.globalData.webOrigin;
    const entryPath = normalizeEntryPath(options.path);
    this.startWechatLogin(origin, entryPath);
  },

  startWechatLogin(origin, entryPath) {
    wx.login({
      success: (result) => {
        if (!result.code) {
          this.openFallback(origin, entryPath);
          return;
        }

        this.setData({
          loading: false,
          webUrl: buildWebUrl(origin, entryPath, result.code),
        });
      },
      fail: () => {
        this.openFallback(origin, entryPath);
      },
    });
  },

  openFallback(origin, entryPath) {
    const separator = entryPath.includes('?') ? '&' : '?';
    this.setData({
      loading: false,
      webUrl: `${origin}${entryPath}${separator}mp_shell_build=${SHELL_BUILD}&mp_entry_ts=${Date.now()}`,
    });
  },
});
