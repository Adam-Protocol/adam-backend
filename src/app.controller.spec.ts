import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { StarknetService } from './starknet/starknet.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: { $queryRaw: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: StarknetService, useValue: { rpcProvider: { getBlockNumber: jest.fn() } } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Adam Protocol API v1.0"', () => {
      expect(appController.getHello()).toBe('Adam Protocol API v1.0');
    });
  });
});
