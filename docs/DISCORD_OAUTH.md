# Discord OAuth (dev setup)

Sign-in uses Discord OAuth2. The `redirect_uri` sent in both the authorize redirect and token exchange must **exactly** match a URL registered under **OAuth2 → Redirects** in the [Discord Developer Portal](https://discord.com/developers/applications).

## Production (graardor.com)

Register this redirect URI:

```
https://www.graardor.com/api/auth/discord/callback
```

The app canonicalizes both `graardor.com` and `www.graardor.com` to the `www` callback above. You do **not** need a separate apex redirect unless you intentionally send a different `DISCORD_REDIRECT_URI`.

Optional but recommended Vercel env var (must match Discord exactly):

```
DISCORD_REDIRECT_URI=https://www.graardor.com/api/auth/discord/callback
```

Also required on Vercel:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`

## Local development

Add a localhost redirect in the same Discord app (or a separate dev app):

```
http://localhost:3000/api/auth/discord/callback
```

When `DISCORD_REDIRECT_URI` is unset, local requests use `http://localhost:<port>/api/auth/discord/callback` from the request host.

## Implementation

- Authorize: `api/auth/discord.js`
- Callback / token exchange: `api/auth/discord/callback.js`
- Redirect URI helper: `lib/url.js` → `getDiscordRedirectUri()`

Both handlers must use the same `getDiscordRedirectUri()` value or Discord returns `invalid OAuth 2 redirect_uri`.
