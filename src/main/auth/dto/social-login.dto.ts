import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SocialLoginDto {
  @ApiProperty({
    description: 'Firebase ID Token from Google/Facebook login',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImI...',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiPropertyOptional({
    description: 'FCM Token for push notifications',
    example: 'dGhpcy1pcz1hLXRlc3QtZmNtLXRva2Vu',
  })
  @IsString()
  @IsOptional()
  fcmToken?: string;
}
