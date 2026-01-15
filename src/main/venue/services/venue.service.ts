import { successResponse, TResponse } from '@/common/utils/response.util';
import { AppError } from '@/core/error/handle-error.app';
import { HandleError } from '@/core/error/handle-error.decorator';
import { ParseJsonPipe } from '@/core/pipe/parse-json.pipe';
import { S3Service } from '@/lib/file/services/s3.service';
import { GoogleMapsService } from '@/lib/google-maps/google-maps.service';
import { PrismaService } from '@/lib/prisma/prisma.service';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { FileInstance } from '@prisma';
import { CreateVenueDto } from '../dto/create-venue.dto';
import { UpdateVenueDto } from '../dto/update-venue.dto';

@Injectable()
export class VenueService {
  private readonly logger = new Logger(VenueService.name);
  private readonly parsePipe = new ParseJsonPipe();

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly googleMaps: GoogleMapsService,
  ) {}

  @HandleError('Failed to create venue')
  async create(
    data: CreateVenueDto,
    file?: Express.Multer.File,
  ): Promise<TResponse<any>> {
    if (!data || !data.coreInfo) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'Invalid request body');
    }

    const dto = this.parsePipe.transform(data.coreInfo);
    this.logger.debug(`Creating venue with data:`, dto);

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

    // * if image is provided, upload to S3 and update user
    let fileInstance: FileInstance | undefined;
    if (file) {
      const uploadFile = await this.s3.uploadFile(file);

      if (uploadFile) {
        fileInstance = uploadFile;
      }
    }

    const venue = await this.prisma.client.venue.create({
      data: {
        name: dto.name,
        catgegory: dto.catgegory,
        subcategory: dto.subcategory,
        location: dto.location,
        latitude: dto.latitude,
        longitude: dto.longitude,
        description: dto.description,
        source: 'database',
        operatingHours: {
          createMany: {
            data:
              dto.operatingHours?.map((oh: any) => ({
                day: oh.day % 7, // Convert 1-7 (Mon-Sun) to 0-6 (Sun-Sat)
                startTime: oh.startTime,
                endTime: oh.endTime,
              })) || [],
          },
        },

        ...(fileInstance && {
          image: {
            connect: fileInstance,
          },
          imageUrl: fileInstance.url,
        }),
      },
      include: {
        image: true,
        operatingHours: true,
      },
    });

    return successResponse(venue, 'Venue created successfully');
  }

  @HandleError('Failed to update venue')
  async update(
    id: string,
    data: UpdateVenueDto,
    file?: Express.Multer.File,
  ): Promise<TResponse<any>> {
    // Check if venue exists
    const venueExists = await this.prisma.client.venue.findUniqueOrThrow({
      where: { id },
    });

    if (!data || !data.coreInfo) {
      throw new AppError(400, 'No data provided for update');
    }

    const dto = this.parsePipe.transform(data.coreInfo);
    this.logger.debug(`Updating venue ${id} with data:`, dto);

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

    // * if image is provided, upload to S3 and update user
    let fileInstance: FileInstance | undefined;
    if (file) {
      const uploadFile = await this.s3.uploadFile(file);

      if (uploadFile) {
        fileInstance = uploadFile;
      }

      // * if venue has existing image, delete it
      if (venueExists.imageId) {
        await this.s3.deleteFile(venueExists.imageId);
      }
    }

    const venue = await this.prisma.client.venue.update({
      where: { id },
      data: {
        name: dto.name,
        catgegory: dto.catgegory,
        subcategory: dto.subcategory,
        location: dto.location,
        latitude: dto.latitude,
        longitude: dto.longitude,
        description: dto.description,
        source: 'database',
        ...(dto.operatingHours && {
          operatingHours: {
            deleteMany: {},
            createMany: {
              data: dto.operatingHours.map((oh: any) => ({
                day: oh.day % 7, // Convert 1-7 (Mon-Sun) to 0-6 (Sun-Sat)
                startTime: oh.startTime,
                endTime: oh.endTime,
              })),
            },
          },
        }),

        ...(fileInstance && {
          image: {
            connect: fileInstance,
          },
          imageUrl: fileInstance.url,
        }),
      },
      include: {
        image: true,
        operatingHours: true,
      },
    });

    return successResponse(venue, 'Venue updated successfully');
  }

  @HandleError('Failed to delete venue')
  async remove(id: string): Promise<TResponse<any>> {
    // Check if venue exists
    await this.prisma.client.venue.findUniqueOrThrow({
      where: { id },
    });

    await this.prisma.client.venue.delete({
      where: { id },
    });

    return successResponse(null, 'Venue deleted successfully');
  }
}
