import { Public, ValidateAdmin, ValidateAuth } from '@/core/jwt/jwt.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { CreateVenueDto } from './dto/create-venue.dto';
import { GetVenuesDto } from './dto/get-venues.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { GetVenuesService } from './services/get-venues.service';
import { VenuePublicService } from './services/venue-public.service';
import { VenueService } from './services/venue.service';

@ApiTags('Venue (Admin)')
@Controller('venue')
@ApiBearerAuth()
@ValidateAdmin()
export class VenueController {
  constructor(
    private readonly venueService: VenueService,
    private readonly venuePublicService: VenuePublicService,
    private readonly getVenuesService: GetVenuesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new venue' })
  @ValidateAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  create(
    @Body() createVenueDto: CreateVenueDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.venueService.create(createVenueDto, file);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a venue' })
  @ApiParam({ name: 'id', description: 'Venue ID' })
  @ValidateAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  update(
    @Param('id') id: string,
    @Body() updateVenueDto: UpdateVenueDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.venueService.update(id, updateVenueDto, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a venue' })
  @ApiParam({ name: 'id', description: 'Venue ID' })
  remove(@Param('id') id: string) {
    return this.venueService.remove(id);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all venues (Public)' })
  findAll() {
    return this.venuePublicService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a venue by ID (Public)' })
  @ApiParam({ name: 'id', description: 'Venue ID' })
  findOne(@Param('id') id: string) {
    return this.venuePublicService.findOne(id);
  }

  @Get('admin/list')
  @ApiOperation({ summary: 'Get venues with filters (Admin)' })
  async getVenuesAdmin(@Query() dto: GetVenuesDto) {
    return this.getVenuesService.getAllVenues(dto);
  }

  @Get('admin/:id')
  @ApiOperation({ summary: 'Get a single venue by ID (Admin)' })
  @ApiParam({ name: 'id', description: 'Venue ID' })
  async getSingleVenueAdmin(@Param('id') id: string) {
    return this.getVenuesService.getSingleVenue(id);
  }
}
