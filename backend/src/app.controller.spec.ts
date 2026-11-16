jest.mock('./app.service', () => ({
  AppService: class AppServiceMock {},
}));

jest.mock('./app.service.js', () => ({
  AppService: class AppServiceMock {},
}));

jest.mock('./prisma/prisma.service', () => ({
  PrismaService: class PrismaServiceMock {},
}));

jest.mock('./prisma/prisma.service.js', () => ({
  PrismaService: class PrismaServiceMock {},
}));

jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class PrismaClientMock {},
  Prisma: {},
}));

jest.mock('../generated/prisma/client.js', () => ({
  PrismaClient: class PrismaClientMock {},
  Prisma: {},
}));

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class PrismaPgMock {},
}));

jest.mock('pg', () => ({
  __esModule: true,
  default: {
    Pool: class PoolMock {},
  },
}));

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigServiceMock {},
}));

const { AppController } = require('./app.controller');

describe('AppController', () => {
  let appController: any;

  beforeEach(async () => {
    appController = new AppController({
      getHello: () => 'Hello World!',
    } as any);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
