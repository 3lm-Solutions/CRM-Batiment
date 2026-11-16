import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  JwtPayload,
  CurrentUserPayload,
} from '../../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secretOrKey =
      configService.get<string>('JWT_SECRET') || 'fallback-secret';
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey,
    });
  }

  /**
   * Appelé automatiquement par Passport après vérification du JWT.
   * Le résultat est injecté dans request.user
   */
  validate(payload: JwtPayload): CurrentUserPayload {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId,
    };
  }
}
