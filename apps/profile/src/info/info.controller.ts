import { Controller, Body, Post, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { InfoService } from './info.service';
import type { NewInfoDto, InfoDto } from './dto/info.dto';
import { NewInfoSchema, InfoSchema } from './dto/info.dto';

@Controller('info')
@ApiTags('info')
@ApiCreatedResponse({ standardSchema: InfoSchema })
export class InfoController {
  constructor(private readonly infoService: InfoService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user info' })
  async createInfo(@Body({ schema: NewInfoSchema }) data: NewInfoDto) {
    return await this.infoService.createInfo(data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'get user info by info id' })
  async getInfoById(@Param('id') id: string): Promise<InfoDto | null> {
    return await this.infoService.getInfoById(id);
  }

  @Get()
  @ApiOperation({ summary: 'get info for all users' })
  async getAllInfo(): Promise<InfoDto[] | null> {
    return await this.infoService.getAllInfo();
  }
}
