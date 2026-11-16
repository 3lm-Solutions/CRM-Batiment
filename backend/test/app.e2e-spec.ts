import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, INestApplication } from '@nestjs/common';
import request from 'supertest';

class TestAppService {
  getHello() {
    return 'Hello World!';
  }
}

@Controller()
class TestAppController {
  constructor(private readonly appService: TestAppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TestAppController],
      providers: [TestAppService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];

    return request(httpServer).get('/').expect(200).expect('Hello World!');
  });
});
