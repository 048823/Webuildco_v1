# WEB-318 Cloudflare Apex Redirect Rule

Do not apply this before the board deploy nod. This repo is deployed from
`main`, but the apex redirect is a Cloudflare zone-level Redirect Rule, not a
static asset change.

## Rule

Create a Single Redirect Rule in the `webuildco.com.au` zone:

- Rule name: `WEB-318 apex to www`
- Match: wildcard pattern
- Request URL: `https://webuildco.com.au/*`
- Target URL: `https://www.webuildco.com.au/${1}`
- Status code: `301`
- Preserve query string: enabled

Rules expression equivalent:

```text
http.host eq "webuildco.com.au" and http.request.scheme eq "https"
```

Dynamic target equivalent:

```text
concat("https://www.webuildco.com.au", http.request.uri.path)
```

## Verification After Apply

```bash
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" https://webuildco.com.au/
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://webuildco.com.au/work/?utm_source=test"
```

Expected:

- `https://webuildco.com.au/` returns `301` to `https://www.webuildco.com.au/`
- Path and query strings are preserved on the `www` target.
