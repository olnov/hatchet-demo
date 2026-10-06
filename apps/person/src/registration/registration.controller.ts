import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiAcceptedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RegisterSchema } from './dto/register.dto.js';
import { RegistrationService } from './registration.service.js';

@Controller()
@ApiTags('registration')
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Register a person' })
  @ApiAcceptedResponse()
  register(@Body() body: unknown) {
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    return this.registration.register(parsed.data);
  }

  @Get('registrations/:runId')
  @ApiOperation({ summary: 'Get registation task status from Hatchet' })
  @ApiOkResponse()
  getIssueLinkTaskStatus(@Param('runId') runId: string) {
    return this.registration.getRegistrationTaskStatus(runId);
  }
}
