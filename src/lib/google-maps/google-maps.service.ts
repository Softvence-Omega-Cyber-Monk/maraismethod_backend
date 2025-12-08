import { ENVEnum } from '@/common/enum/env.enum';
import { Client } from '@googlemaps/google-maps-services-js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleMapsService {
  private client: Client;
  private apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Client({});
    this.apiKey = this.configService.getOrThrow<string>(
      ENVEnum.GOOGLE_MAPS_API_KEY,
    );
  }

  getClient(): Client {
    return this.client;
  }

  getApiKey(): string {
    return this.apiKey;
  }
}
