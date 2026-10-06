import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  IssueProfileLinkSchema,
  type IssueProfileLinkDto,
} from './dto/profile-link.dto.js';
import { ProfileLinksService } from './profile-links.service.js';

@Controller('internal')
@ApiTags('internal')
export class ProfileLinksController {
  constructor(private readonly profileLinks: ProfileLinksService) {}

  @Post('links')
  @ApiOperation({ summary: 'Issue a profile link for a person' })
  @ApiCreatedResponse()
  issue(@Body({ schema: IssueProfileLinkSchema }) data: IssueProfileLinkDto) {
    return this.profileLinks.issue(data.personId);
  }
}
