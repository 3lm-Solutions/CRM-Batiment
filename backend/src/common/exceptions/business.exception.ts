import { BadRequestException } from '@nestjs/common';

export class BusinessException extends BadRequestException {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessException';
  }
}
