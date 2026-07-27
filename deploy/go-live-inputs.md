# Go-Live Inputs

These inputs are still required before the project can be switched from the current `IP + HTTP + hybrid WeChat` setup to a real production domain with HTTPS and official WeChat login/payment.

## 1. Domain and HTTPS

Provide all of the following:

- Primary domain: `campusgrow.top`
- Optional redirect domain: `www.campusgrow.top`
- DNS control for the domain so the A record can point to the ECS public IP

Recommended Nginx template:

- [campus-growth-https.conf](/d:/github/zhejiang-competiton/deploy/nginx/campus-growth-https.conf)

After DNS resolves, the server can issue a Let's Encrypt certificate and switch Nginx from the current HTTP-only config to the HTTPS config.

## 2. WeChat Mini Program Login

Provide all of the following:

- Mini Program `AppID`
- Mini Program `AppSecret`
- The final production domain used by the frontend

Required server env:

```env
WECHAT_APP_ID=
WECHAT_APP_SECRET=
WECHAT_LOGIN_MODE=real
API_PUBLIC_ORIGIN=https://campusgrow.top
```

Also make sure the Mini Program console is updated with the legal request domain for the API.

## 3. WeChat Pay v3

Provide all of the following:

- WeChat Pay merchant ID
- Merchant API certificate serial number
- Merchant private key file
- API v3 key
- WeChat Pay platform public key or platform certificate
- WeChat Pay platform serial number
- Final notify URL domain

Required server env:

```env
WECHAT_PAY_MODE=real
WECHAT_PAY_APP_ID=
WECHAT_PAY_MCH_ID=
WECHAT_PAY_SERIAL_NO=
WECHAT_PAY_PRIVATE_KEY_PATH=
WECHAT_PAY_API_V3_KEY=
WECHAT_PAY_NOTIFY_URL=https://campusgrow.top/api/payments/wechat/notify
WECHAT_PAY_REFUND_NOTIFY_URL=https://campusgrow.top/api/payments/wechat/refund-notify
WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH=
WECHAT_PAY_PLATFORM_CERT_PATH=
WECHAT_PAY_PLATFORM_SERIAL=
```

## 4. Current Production State

The current live state is:

- API is already on PostgreSQL
- Object storage is already on Aliyun OSS
- Home-feed images are served through backend proxy URLs, so the OSS bucket can stay private
- Frontend can now use same-origin `/api`, which is ready for HTTPS cutover
