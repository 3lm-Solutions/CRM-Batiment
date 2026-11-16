import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * A business rule was violated (e.g. signing a quote with no lines).
 *
 * v2: returns 422 (Unprocessable Entity) instead of 400, so the frontend can tell
 * "your form is malformed" (400) from "this action is not allowed right now" (422),
 * and carries a stable `code` the UI can switch on.
 *
 * @example throw new BusinessException('DEVIS_SANS_LIGNES', 'Impossible de signer un devis sans lignes.');
 */
export class BusinessException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.UNPROCESSABLE_ENTITY,
  ) {
    super({ message, code }, status);
  }
}
