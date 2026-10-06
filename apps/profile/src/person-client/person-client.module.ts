import { Module } from '@nestjs/common';
import { PersonClient } from './person-client.service.js';

@Module({ providers: [PersonClient], exports: [PersonClient] })
export class PersonClientModule {}
