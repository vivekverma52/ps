import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SuperadminLoginDto } from './dto/superadmin-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Cookies } from '../../common/decorators/cookies.decorator';
import { HttpMessage } from '../../common/decorators/message.decorator';
import {
  RefreshTokenInterceptor,
  ClearRefreshCookie,
} from '../../common/interceptors/refresh-token.interceptor';

/**
 * HTTP layer only — no business logic, no cookie mechanics.
 *
 * Responsibilities:
 *   - Parse & validate incoming DTOs (via class-validator)
 *   - Delegate entirely to AuthService
 *   - Declare which interceptors handle cross-cutting concerns
 *
 * Cookie lifecycle is owned by RefreshTokenInterceptor.
 * Response envelope is owned by ResponseInterceptor (global).
 */
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Superadmin ────────────────────────────────────────────────────────────

  @Post('superadmin/login')
  @HttpCode(HttpStatus.OK)
  @HttpMessage('Login successful')
  superadminLogin(@Body() dto: SuperadminLoginDto) {
    return this.authService.superadminLogin(dto.email, dto.password);
  }

  // ── Organisation users ────────────────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @HttpMessage('Registered successfully')
  @UseInterceptors(RefreshTokenInterceptor)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @HttpMessage('Login successful')
  @UseInterceptors(RefreshTokenInterceptor)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: { userId: string }) {
    return this.authService.getMe(user.userId);
  }

  // ── Token management ──────────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @HttpMessage('Token refreshed')
  @UseInterceptors(RefreshTokenInterceptor)
  refresh(@Cookies('refreshToken') token: string | undefined) {
    if (!token) throw new UnauthorizedException('Refresh token missing');
    return this.authService.refresh(token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @HttpMessage('Logged out successfully')
  @UseInterceptors(RefreshTokenInterceptor)
  @ClearRefreshCookie()
  async logout(@Cookies('refreshToken') token: string | undefined) {
    if (token) await this.authService.logout(token);
    return null;
  }

  // ── Password reset ────────────────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @HttpMessage('Password reset successfully')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.otp, dto.password);
  }
}
