import { Test, TestingModule } from '@nestjs/testing';
import { TokenService } from './token.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';

describe('TokenService', () => {
  let service: TokenService;

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  const mockPrisma = {
    transaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: 'PrismaService', useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: getQueueToken('chain-tx'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buy()', () => {
    const buyDto = {
      wallet: '0x049',
      amount_in: '5000000',
      token_out: 'adusd' as const,
      commitment: '0xcommit1',
    };

    it('should create a pending transaction and enqueue buy job', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      mockPrisma.transaction.create.mockResolvedValue({ id: 'tx-1' } as any);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await service.buy(buyDto as any);

      expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'buy',
            commitment: '0xcommit1',
            status: 'pending',
          }),
        }),
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        'submit-buy',
        expect.any(Object),
        expect.any(Object),
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((result as any).status).toBe('pending');
    });

    it('should throw BadRequestException if commitment already exists', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'existing-tx',
      });

      await expect(service.buy(buyDto)).rejects.toThrow(BadRequestException);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('sell()', () => {
    const sellDto = {
      wallet: '0x049',
      token_in: 'adngn' as const,
      amount: '1000000000000000000',
      nullifier: '0xnull1',
      commitment: '0xcommit2',
      currency: 'NGN' as const,
      bank_account: '0123456789',
      bank_code: '044',
    };

    it('should create a pending sell transaction and enqueue job', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue(null);

      mockPrisma.transaction.create.mockResolvedValue({ id: 'tx-2' } as any);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const result = await service.sell(sellDto as any);

      expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'sell',
            nullifier: '0xnull1',
            bank_account: '0123456789',
          }),
        }),
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        'submit-sell',
        expect.any(Object),
        expect.any(Object),
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((result as any).status).toBe('pending');
    });

    it('should throw BadRequestException if nullifier already spent', async () => {
      mockPrisma.transaction.findFirst.mockResolvedValue({ id: 'spent-tx' });

      await expect(service.sell(sellDto)).rejects.toThrow(BadRequestException);
    });
  });
});
