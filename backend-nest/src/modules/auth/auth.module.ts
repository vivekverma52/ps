import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenInterceptor } from '../../common/interceptors/refresh-token.interceptor';

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    JwtStrategy,
    RefreshTokenInterceptor,
  ],
  exports: [AuthService],
})
export class AuthModule {}
