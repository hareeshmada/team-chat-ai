import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger.js';

const REQUEST_ID_HEADER = 'x-request-id';
// Only trust simple ids from clients/proxies, so nobody can inject junk into our logs.
const VALID_REQUEST_ID = /^[\w-]{1,64}$/;

export const requestLogger = pinoHttp({
  logger,
  // req.log only carries { reqId }, so every log line written during a request has the id.
  quietReqLogger: true,
  genReqId(req, res) {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const id =
      typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
