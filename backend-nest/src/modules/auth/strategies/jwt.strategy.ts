import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from '../auth.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {

  constructor(
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    if (!payload || payload.type === 'REFRESH') {
      throw new UnauthorizedException({ message: 'Invalid token type', errorCode: 'UNAUTHORIZED' });
    }

    // Live status check — rejects SUSPENDED or deleted users even within JWT TTL
    const user = await this.authRepository.findUserById(payload.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException({ message: 'Account is suspended or not found', errorCode: 'UNAUTHORIZED' });
    }

    return payload;
  }
}
