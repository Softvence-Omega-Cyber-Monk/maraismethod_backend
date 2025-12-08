import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SocialLoginDto {
  @ApiProperty({
    description: 'Firebase ID Token from Google/Facebook login',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImI...',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
