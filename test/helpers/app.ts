import { Test } from '@nestjs/testing';
import type { INestApplication, Type } from '@nestjs/common';
import request from 'supertest';

export type Json = Record<string, unknown>;
export type Headers = Record<string, string>;

export interface TestApp {
  post(path: string, body?: Json, headers?: Headers): Promise<request.Response>;
  get(path: string, headers?: Headers): Promise<request.Response>;
  close(): Promise<void>;
  instance: INestApplication;
}

/**
 * Поднимает приложение в этом же процессе и отдаёт короткие post/get.
 *
 * Внутрипроцессный запуск — для тестов одного сервиса: быстро и не
 * требует поднятых контейнеров. Для межсервисных сценариев (этапы 5+)
 * используется httpClient ниже: там важно, что сервисы РАЗНЫЕ процессы.
 */
export async function createTestApp(appModule: Type): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [appModule] }).compile();
  const instance = moduleRef.createNestApplication();
  await instance.init();
  const server = instance.getHttpServer();

  return {
    instance,
    post: (path, body = {}, headers = {}) =>
      request(server).post(path).set(headers).send(body),
    get: (path, headers = {}) => request(server).get(path).set(headers),
    close: () => instance.close(),
  };
}
