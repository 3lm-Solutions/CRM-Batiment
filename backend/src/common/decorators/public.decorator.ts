import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opens a route to unauthenticated visitors.
 * Every route is protected by default — this is the ONLY way to make one public.
 * Use for: login, health, chatbot widget, demo form, client signature link, webhooks.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
