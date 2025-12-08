import { GetUser, ValidateAdmin, ValidateAuth } from '@/core/jwt/jwt.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AdminLoginDto, LoginDto } from './dto/login.dto';
import { LogoutDto, RefreshTokenDto } from './dto/logout.dto';
import { ResendOtpDto, VerifyOTPDto } from './dto/otp.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password.dto';
import { RegisterDto } from './dto/register.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { UpdateAdminSettingDto } from './dto/update-admin-setting.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthGetProfileService } from './services/auth-get-profile.service';
import { AuthLoginService } from './services/auth-login.service';
import { AuthLogoutService } from './services/auth-logout.service';
import { AuthOtpService } from './services/auth-otp.service';
import { AuthPasswordService } from './services/auth-password.service';
import { AuthRegisterService } from './services/auth-register.service';
import { AuthSettingService } from './services/auth-setting.service';
import { AuthSocialService } from './services/auth-social.service';
import { AuthUpdateProfileService } from './services/auth-update-profile.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authRegisterService: AuthRegisterService,
    private readonly authLoginService: AuthLoginService,
    private readonly authLogoutService: AuthLogoutService,
    private readonly authOtpService: AuthOtpService,
    private readonly authPasswordService: AuthPasswordService,
    private readonly authGetProfileService: AuthGetProfileService,
    private readonly authUpdateProfileService: AuthUpdateProfileService,
    private readonly authSocialService: AuthSocialService,
    private readonly authSettingService: AuthSettingService,
  ) {}

  @ApiOperation({ summary: 'User Registration with Email' })
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authRegisterService.register(body);
  }

  @ApiOperation({ summary: 'Social Login (Google/Facebook)' })
  @Post('social-login')
  async socialLogin(@Body() body: SocialLoginDto) {
    return this.authSocialService.socialLogin(body);
  }

  @ApiOperation({ summary: 'Verify OTP' })
  @Post('verify-otp')
  async verifyEmail(@Body() body: VerifyOTPDto) {
    return this.authOtpService.verifyOTP(body);
  }

  @ApiOperation({ summary: 'Resend OTP to Email' })
  @Post('resend-otp')
  async resendOtp(@Body() body: ResendOtpDto) {
    return this.authOtpService.resendOtp(body);
  }

  @ApiOperation({ summary: 'User Login' })
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authLoginService.login(body);
  }

  @ApiOperation({ summary: 'Admin Login (with optional 2FA)' })
  @Post('admin/login')
  async adminLogin(@Body() body: AdminLoginDto) {
    return this.authLoginService.adminLogin(body);
  }

  @ApiOperation({ summary: 'User Logout' })
  @ApiBearerAuth()
  @Post('logout')
  @ValidateAuth()
  async logOut(@GetUser('sub') userId: string, @Body() dto: LogoutDto) {
    return this.authLogoutService.logout(userId, dto);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authLogoutService.refresh(dto);
  }

  @ApiOperation({ summary: 'Change Password' })
  @ApiBearerAuth()
  @Post('password/change')
  @ValidateAuth()
  async changePassword(
    @GetUser('sub') userId: string,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authPasswordService.changePassword(userId, body);
  }

  @ApiOperation({ summary: 'Forgot Password' })
  @Post('password/forgot')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authPasswordService.forgotPassword(body.email);
  }

  @ApiOperation({ summary: 'Reset Password' })
  @Post('password/reset')
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authPasswordService.resetPassword(body);
  }

  @ApiOperation({ summary: 'Get User Profile' })
  @ApiBearerAuth()
  @Get('profile')
  @ValidateAuth()
  async getProfile(@GetUser('sub') userId: string) {
    return this.authGetProfileService.getProfile(userId);
  }

  @ApiOperation({ summary: 'Update profile' })
  @ApiBearerAuth()
  @Patch()
  @ValidateAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  update(
    @GetUser('sub') id: string,
    @Body() dto: UpdateProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.authUpdateProfileService.updateProfile(id, dto, file);
  }

  @Get('get-settings')
  @ApiBearerAuth()
  @ValidateAdmin()
  @ApiOperation({ summary: 'Get admin settings' })
  getSettings() {
    return this.authSettingService.getSettings();
  }

  @Patch('update-settings')
  @ApiBearerAuth()
  @ValidateAdmin()
  @ApiOperation({ summary: 'Update admin settings (partial update)' })
  updateSettings(@Body() dto: UpdateAdminSettingDto) {
    return this.authSettingService.updateSettings(dto);
  }

  @Patch('toggle/:key')
  @ApiBearerAuth()
  @ValidateAdmin()
  @ApiParam({
    name: 'key',
    enum: ['pushNotificationsEnabled', 'showSearchBarInApp'],
  })
  @ApiOperation({ summary: 'Toggle a single admin setting by key' })
  toggleSetting(@Param('key') key: keyof UpdateAdminSettingDto) {
    return this.authSettingService.toggle(key);
  }

  @Patch('toggle-2fa')
  @ApiBearerAuth()
  @ValidateAdmin()
  @ApiOperation({ summary: 'Toggle 2FA for current admin user' })
  toggle2FA(@GetUser('sub') userId: string) {
    return this.authSettingService.toggle2FA(userId);
  }
}
