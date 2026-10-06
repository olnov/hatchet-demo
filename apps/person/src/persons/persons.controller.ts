import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PersonsService } from './persons.service.js';

@Controller('persons')
@ApiTags('persons')
export class PersonsController {
  constructor(private readonly persons: PersonsService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get safe person data' })
  @ApiOkResponse()
  get(@Param('id') id: string) {
    return this.persons.get(id);
  }

  @Patch(':id/profile-completed')
  @ApiOperation({ summary: 'Mark a person profile as completed' })
  @ApiOkResponse()
  markProfileCompleted(@Param('id') id: string) {
    return this.persons.markProfileCompleted(id);
  }
}
