import { ValidateAdmin, ValidateAuth } from '@/core/jwt/jwt.decorator';
import {
  Body,
  Controller,
  Delete,
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
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { VenueService } from './venue.service';

@ApiTags('Venue (Admin)')
@Controller('venue')
@ApiBearerAuth()
@ValidateAdmin()
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

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

  @Get()
  @ApiOperation({ summary: 'Get all venues' })
  findAll() {
    return this.venueService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a venue by ID' })
  @ApiParam({ name: 'id', description: 'Venue ID' })
  findOne(@Param('id') id: string) {
    return this.venueService.findOne(id);
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
}
