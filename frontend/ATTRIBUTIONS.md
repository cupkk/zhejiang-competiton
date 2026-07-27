This Figma Make file includes components from [shadcn/ui](https://ui.shadcn.com/) used under [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).

This Figma Make file includes photos from [Unsplash](https://unsplash.com) used under [license](https://unsplash.com/license).

The login image cached at `frontend/public/campus-login.webp` comes from Unsplash image `photo-1632834380561-d1e05839a33a`. It is stored locally so the login screen does not depend on a third-party CDN at runtime.

School logo images under `frontend/public/school-logos/` were cached from the public Gaokao school logo endpoint:

- Search API: https://api.eol.cn/gkcx/api/
- Logo CDN pattern: https://static-data.gaokao.cn/upload/logo/{school_id}.png

These logos are used only to identify schools inside the school selection interface. Replace them with school-provided assets when a school becomes an official partner.

The WeChat brand glyph in `frontend/public/wechat-logo.svg` is sourced from [Simple Icons](https://simpleicons.org/?q=wechat). WeChat is a trademark of Tencent; the glyph is used only to identify the WeChat login action.
