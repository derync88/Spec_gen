/** Central error handler. Keeps responses in { message, errorType? } shape. */
export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) {
    console.error('[error]', err);
  }
  res.status(status).json({
    message: err.publicMessage || err.message || 'Internal server error',
    ...(err.errorType ? { errorType: err.errorType } : {}),
  });
}

/** Helper to throw an HTTP error with a status code. */
export function httpError(status, message, errorType) {
  const err = new Error(message);
  err.status = status;
  err.publicMessage = message;
  if (errorType) err.errorType = errorType;
  return err;
}
