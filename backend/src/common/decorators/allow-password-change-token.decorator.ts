import { SetMetadata } from '@nestjs/common';

export const ALLOW_PASSWORD_CHANGE_TOKEN_KEY = 'allowPasswordChangeToken';

/**
 * Marks the (few) routes that accept the restricted `password-change` token.
 * Only POST /auth/change-password uses it.
 */
export const AllowPasswordChangeToken = () => SetMetadata(ALLOW_PASSWORD_CHANGE_TOKEN_KEY, true);
