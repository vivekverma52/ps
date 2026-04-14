import { AppError } from './app.error';

/**
 * MySQL/TCP error codes we explicitly recognize.
 * Reference: https://dev.mysql.com/doc/mysql-errors/8.0/en/server-error-reference.html
 */
const MYSQL_ERROR_MAP: Record<string, { status: number; message: string; code: string }> = {
  // ── Connectivity ────────────────────────────────────────────────────────
  ECONNREFUSED:          { status: 503, message: 'Database connection refused. The server may be starting up.', code: 'DB_UNAVAILABLE' },
  ENOTFOUND:             { status: 503, message: 'Database host not found. Check DB_HOST configuration.',       code: 'DB_UNAVAILABLE' },
  ETIMEDOUT:             { status: 503, message: 'Database connection timed out.',                              code: 'DB_UNAVAILABLE' },
  ECONNRESET:            { status: 503, message: 'Database connection was reset.',                              code: 'DB_UNAVAILABLE' },
  ER_ACCESS_DENIED_ERROR:{ status: 503, message: 'Database access denied. Check credentials.',                 code: 'DB_AUTH_FAILED'  },
  ER_CON_COUNT_ERROR:    { status: 503, message: 'Too many database connections. Please try again shortly.',   code: 'DB_UNAVAILABLE' },

  // ── Schema / query errors (programming mistakes that escape to runtime) ─
  ER_NO_SUCH_TABLE:      { status: 503, message: 'A required database table is missing. Schema may still be initializing.', code: 'DB_SCHEMA_ERROR' },
  ER_BAD_FIELD_ERROR:    { status: 503, message: 'Database schema mismatch — unknown column. A migration may be needed.',   code: 'DB_SCHEMA_ERROR' },
  ER_PARSE_ERROR:        { status: 500, message: 'Internal database query error.',                             code: 'DB_QUERY_ERROR'  },

  // ── Constraint violations ───────────────────────────────────────────────
  ER_DUP_ENTRY:              { status: 409, message: 'Record already exists.',                                 code: 'CONFLICT'        },
  ER_ROW_IS_REFERENCED_2:    { status: 409, message: 'Cannot delete — record is referenced by another table.', code: 'CONFLICT'       },
  ER_NO_REFERENCED_ROW_2:    { status: 400, message: 'Referenced record does not exist.',                      code: 'BAD_REQUEST'     },

  // ── Data errors ─────────────────────────────────────────────────────────
  ER_DATA_TOO_LONG:          { status: 400, message: 'Input value is too long for this field.',                code: 'VALIDATION_ERROR' },
  ER_TRUNCATED_WRONG_VALUE:  { status: 400, message: 'Invalid value for this field type.',                     code: 'VALIDATION_ERROR' },
  ER_BAD_NULL_ERROR:         { status: 400, message: 'A required field was not provided.',                     code: 'VALIDATION_ERROR' },
  ER_WARN_DATA_TRUNCATED:    { status: 400, message: 'Invalid enum or set value.',                             code: 'VALIDATION_ERROR' },

  // ── Locking ─────────────────────────────────────────────────────────────
  ER_LOCK_DEADLOCK:      { status: 409, message: 'Database deadlock detected. Please retry the request.',     code: 'DB_DEADLOCK'     },
  ER_LOCK_WAIT_TIMEOUT:  { status: 503, message: 'Database lock wait timeout. Please retry the request.',     code: 'DB_TIMEOUT'      },
};

/**
 * Returns true when `err` is a raw MySQL/TCP error (has a `code` property
 * and is NOT already an AppError).
 */
export function isMySqlError(err: unknown): boolean {
  if (err instanceof AppError) return false;
  const code = (err as any)?.code;
  return typeof code === 'string' && (
    code.startsWith('ER_') ||
    ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'].includes(code)
  );
}

/**
 * Converts a raw MySQL/TCP error into a structured AppError.
 * Unknown codes are mapped to a generic 500.
 */
export function mapMySqlError(err: unknown): AppError {
  const mysqlCode: string = (err as any)?.code ?? '';
  const sqlMessage: string = (err as any)?.sqlMessage ?? '';
  const mapped = MYSQL_ERROR_MAP[mysqlCode];

  if (mapped) {
    const appErr = new AppError(mapped.message, mapped.status, mapped.code);
    // Attach raw SQL message in non-production so developers can see it
    if (process.env.NODE_ENV !== 'production') {
      appErr.message = `${mapped.message}${sqlMessage ? ` [${mysqlCode}: ${sqlMessage}]` : ''}`;
    }
    return appErr;
  }

  // Unrecognised MySQL error → generic 500 (never leak SQL to client)
  return new AppError('An unexpected database error occurred.', 500, 'DB_ERROR');
}
