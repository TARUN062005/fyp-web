export const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;

    // Log only method, path, status, latency — no headers, body, tokens, or PII
    console.log(
      `[http] ${req.method} ${req.path} ${res.statusCode} ${durationMs.toFixed(1)}ms`
    );
  });

  next();
};
