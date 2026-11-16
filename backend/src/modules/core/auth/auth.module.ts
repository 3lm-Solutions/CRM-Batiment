import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MobileSessionService } from './mobile-session.service';
import { PasswordService } from './password.service';

/** JwtModule, PrismaModule and MailModule are global: nothing to import here. */
@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordService, MobileSessionService],
  exports: [AuthService, PasswordService, MobileSessionService],
})
export class AuthModule {}
