import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DevisService } from './devis.service.js';
import { RespondClientValidationDto } from './dto/respond-client-validation.dto.js';
import { VerifySignatureOtpDto } from './dto/verify-signature-otp.dto.js';
import { SubmitClientSignatureDto } from './dto/submit-client-signature.dto.js';

@ApiTags('Devis Public')
@Controller('devis/public')
export class DevisPublicController {
  constructor(private readonly service: DevisService) {}

  @Get('validation')
  @ApiOperation({
    summary: 'Consulter un devis depuis un lien public securise',
  })
  getValidationPreview(@Query('token') token: string) {
    return this.service.getClientValidationPreview(token);
  }

  @Post('validation/respond')
  @ApiOperation({
    summary: 'Accepter ou refuser un devis depuis le lien client',
  })
  respond(@Body() dto: RespondClientValidationDto) {
    return this.service.respondToClientValidation(dto);
  }

  @Get('signature/:token')
  @ApiOperation({
    summary: 'Consulter l etat du lien public de signature client',
  })
  getPublicSignaturePreview(@Param('token') token: string) {
    return this.service.getPublicSignaturePreview(token);
  }

  @Post('signature/:token/otp/send')
  @ApiOperation({
    summary: 'Envoyer un OTP SMS au client pour valider la signature',
  })
  sendPublicSignatureOtp(@Param('token') token: string) {
    return this.service.sendPublicSignatureOtp(token);
  }

  @Post('signature/:token/otp/verify')
  @ApiOperation({ summary: 'Verifier le code OTP recu par le client' })
  verifyPublicSignatureOtp(
    @Param('token') token: string,
    @Body() dto: VerifySignatureOtpDto,
  ) {
    return this.service.verifyPublicSignatureOtp(token, dto);
  }

  @Post('signature/:token/submit')
  @ApiOperation({ summary: 'Enregistrer la signature manuscrite du client' })
  submitPublicClientSignature(
    @Param('token') token: string,
    @Body() dto: SubmitClientSignatureDto,
  ) {
    return this.service.submitPublicClientSignature(token, dto);
  }
}
