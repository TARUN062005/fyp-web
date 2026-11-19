# Cloud upload abuse signals

`POST /sos/upload` and `POST /broadcast/upload` share one handler.

## Rate limiting

`uploadRateLimiter` is a per-user (else per-IP) sliding window. Default 30
accepted attempts per 15 minutes (`RATE_LIMIT_UPLOAD_MAX`,
`RATE_LIMIT_WINDOW_MS`). Admin login is not rate-limited.

## Independent uploaders

Each distinct authenticated `uploaderId` for a `messageId` is stored in
`uploaders[]`. The response field `corroboration.independentUploaders` is that
set’s size. `originUploaded` is true when the origin account is among them.

This shows that more than one registered session presented the same signed
bytes. It does not show that the SOS event occurred, that GPS is true, or that
the uploaders are independent people.

## Uploader reputation

`User.uploadAcceptCount` / `uploadRejectCount` increment on accepted uploads
and on failed signature or hop-stamp checks after authentication. They are
counters for operators, not a trust score used to drop reports.
