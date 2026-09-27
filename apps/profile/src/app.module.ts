import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller.js';

@Module({
  controllers: [HealthController],
  imports: [ConfigModule.forRoot({ isGlobal: true })],
})
export class AppModule {}
