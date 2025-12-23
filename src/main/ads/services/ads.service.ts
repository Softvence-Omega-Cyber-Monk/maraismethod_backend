import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { S3Service } from '@/lib/file/services/s3.service';
import { GoogleMapsService } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { AdvertisementStatus, FileInstance } from '@prisma';
import { CreateAdDto } from '../dto/create-ad.dto';
import { UpdateAdDto } from '../dto/update-ad.dto';

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly googleMaps: GoogleMapsService,
  ) {}

  @HandleError('Failed to create advertisement')
  async create(
    dto: CreateAdDto,
    file?: Express.Multer.File,
  ): Promise<TResponse<any>> {
    // Validate coordinates using Google Maps
    const isValidCoordinates = await this.googleMaps.validateCoordinates(
      dto.latitude,
      dto.longitude,
    );

    if (!isValidCoordinates) {
      throw new AppError(
        400,
        'Invalid coordinates. Please provide valid latitude and longitude.',
      );
    }

    // Validate date range
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate <= startDate) {
      throw new AppError(400, 'End date must be after start date.');
    }

    // Upload file to S3 if provided
    let fileInstance: FileInstance | undefined;
    if (file) {
      const uploadFile = await this.s3.uploadFile(file);

      if (uploadFile) {
        fileInstance = uploadFile;
      }
    }

    // Create advertisement with analytics record
    const advertisement = await this.prisma.client.advertisement.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        latitude: dto.latitude,
        longitude: dto.longitude,
        adShowRangeInMiles: dto.adShowRangeInMiles,
        status: dto.status as AdvertisementStatus,
        startDate,
        endDate,
        ...(fileInstance && {
          file: {
            connect: fileInstance,
          },
          fileUrl: fileInstance.url,
        }),
        // Auto-create analytics record
        advertisementAnalytics: {
          create: {
            impressions: 0,
            clicks: 0,
          },
        },
      },
      include: {
        file: true,
        advertisementAnalytics: true,
      },
    });

    return successResponse(advertisement, 'Advertisement created successfully');
  }

  @HandleError('Failed to update advertisement')
  async update(
    id: string,
    dto: UpdateAdDto,
    file?: Express.Multer.File,
  ): Promise<TResponse<any>> {
    // Check if advertisement exists
    const adExists = await this.prisma.client.advertisement.findUniqueOrThrow({
      where: { id },
    });

    // Validate coordinates if provided
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      const isValidCoordinates = await this.googleMaps.validateCoordinates(
        dto.latitude,
        dto.longitude,
      );

      if (!isValidCoordinates) {
        throw new AppError(
          400,
          'Invalid coordinates. Please provide valid latitude and longitude.',
        );
      }
    }

    // Validate date range if provided
    if (dto.startDate && dto.endDate) {
      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);

      if (endDate <= startDate) {
        throw new AppError(400, 'End date must be after start date.');
      }
    }

    // Upload file to S3 if provided
    let fileInstance: FileInstance | undefined;
    if (file) {
      const uploadFile = await this.s3.uploadFile(file);

      if (uploadFile) {
        fileInstance = uploadFile;
      }

      // Delete existing file if present
      if (adExists.fileId) {
        await this.s3.deleteFile(adExists.fileId);
      }
    }

    const advertisement = await this.prisma.client.advertisement.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        latitude: dto.latitude,
        longitude: dto.longitude,
        adShowRangeInMiles: dto.adShowRangeInMiles,
        status: dto.status as AdvertisementStatus,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        ...(fileInstance && {
          file: {
            connect: fileInstance,
          },
          fileUrl: fileInstance.url,
        }),
      },
      include: {
        file: true,
        advertisementAnalytics: true,
      },
    });

    return successResponse(advertisement, 'Advertisement updated successfully');
  }

  @HandleError('Failed to delete advertisement')
  async remove(id: string): Promise<TResponse<any>> {
    // Check if advertisement exists
    await this.prisma.client.advertisement.findUniqueOrThrow({
      where: { id },
    });

    await this.prisma.client.advertisement.delete({
      where: { id },
    });

    return successResponse(null, 'Advertisement deleted successfully');
  }
}
