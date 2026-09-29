import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RegisterSchema } from './dto/register.dto.js';
import { RegistrationService } from './registration.service.js';

@Controller()
@ApiTags('registration')
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a person' })
  @ApiCreatedResponse()
  register(@Body() body: unknown) {
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }

    return this.registration.register(parsed.data);
  }
}
