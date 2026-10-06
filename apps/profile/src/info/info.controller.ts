import { Controller, Body, Post, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiAcceptedResponse } from '@nestjs/swagger';
import { InfoService } from './info.service';
import type { NewInfoDto, InfoDto } from './dto/info.dto';
import { NewInfoSchema, InfoSchema } from './dto/info.dto';

@Controller()
@ApiTags('info')
@ApiCreatedResponse({ standardSchema: InfoSchema })
export class InfoController {
  constructor(private readonly infoService: InfoService) {}

  @Get('info/:id')
  @ApiOperation({ summary: 'get user info by info id' })
  async getInfoById(@Param('id') id: string): Promise<InfoDto | null> {
    return await this.infoService.getInfoById(id);
  }

  @Get('info')
  @ApiOperation({ summary: 'get info for all users' })
  async getAllInfo(): Promise<InfoDto[] | null> {
    return await this.infoService.getAllInfo();
  }

  @Get('profiles/:token')
  @ApiOperation({ summary: 'Validate and inspect a profile link' })
  async getProfile(@Param('token') token: string) {
    return this.infoService.getProfile(token);
  }

  @Post('profiles/:token')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Submit a profile through an active link' })
  @ApiAcceptedResponse()
  async submitProfile(
    @Param('token') token: string,
    @Body({ schema: NewInfoSchema }) data: NewInfoDto,
  ) {
    return this.infoService.submit(token, data);
  }
}
