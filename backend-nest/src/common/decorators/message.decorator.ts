import { SetMetadata } from '@nestjs/common';

export const HTTP_MESSAGE_KEY = 'http_response_message';

/**
 * Attaches a human-readable message to a route handler response.
 * Read by ResponseInterceptor and included as `message` in the API envelope.
 *
 * @example
 * @HttpMessage('Login successful')
 * login() { ... }
 */
export const HttpMessage = (message: string) => SetMetadata(HTTP_MESSAGE_KEY, message);
