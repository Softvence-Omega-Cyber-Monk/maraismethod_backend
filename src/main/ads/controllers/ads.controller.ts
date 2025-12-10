import { ValidateAdmin, ValidateAuth } from '@/core/jwt/jwt.decorator';
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
import { CreateAdDto } from '../dto/create-ad.dto';
import { GetAdsDto } from '../dto/get-ads.dto';
import { UpdateAdDto } from '../dto/update-ad.dto';
import { AdsService } from '../services/ads.service';
import { GetAdsService } from '../services/get-ads.service';

@ApiTags('Ads (Admin)')
@Controller('ads')
@ApiBearerAuth()
@ValidateAdmin()
export class AdsController {
  constructor(
    private readonly adsService: AdsService,
    private readonly getAdsService: GetAdsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new advertisement' })
  @ValidateAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  create(
    @Body() createAdDto: CreateAdDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.adsService.create(createAdDto, file);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an advertisement' })
  @ApiParam({ name: 'id', description: 'Advertisement ID' })
  @ValidateAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  update(
    @Param('id') id: string,
    @Body() updateAdDto: UpdateAdDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.adsService.update(id, updateAdDto, file);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an advertisement' })
  @ApiParam({ name: 'id', description: 'Advertisement ID' })
  remove(@Param('id') id: string) {
    return this.adsService.remove(id);
  }

  @Get('admin/list')
  @ApiOperation({ summary: 'Get advertisements with filters (Admin)' })
  async getAdsAdmin(@Query() dto: GetAdsDto) {
    return this.getAdsService.getAllAds(dto);
  }

  @Get('admin/:id')
  @ApiOperation({ summary: 'Get a single advertisement by ID (Admin)' })
  @ApiParam({ name: 'id', description: 'Advertisement ID' })
  async getSingleAdAdmin(@Param('id') id: string) {
    return this.getAdsService.getSingleAd(id);
  }
}
