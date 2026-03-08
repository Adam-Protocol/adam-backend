import { Test, TestingModule } from '@nestjs/testing';
import { SwapService } from './swap.service';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';

describe('SwapService', () => {
  let service: SwapService;

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  const mockPrisma = {
    transaction: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        EXCHANGE_RATE_API_KEY: 'test_key',
        EXCHANGE_RATE_API_URL: 'https://v6.exchangerate-api.com/v6',
      };
      return map[key] ?? null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwapService,
        { provide: 'PrismaService', useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: getQueueToken('chain-tx'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<SwapService>(SwapService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return cached rate if available', async () => {
    // Simulate a cached rate
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (service as any).cachedRate = { usd_ngn: 1600, updated_at: new Date() };
    const rate = await service.getLiveRate();
    expect(rate.usd_ngn).toBe(1600);
  });

  it('should create a transaction and enqueue swap job', async () => {
    mockPrisma.transaction.create.mockResolvedValue({ id: 'tx-1' } as any);
    // Inject cached rate so no HTTP call is made
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (service as any).cachedRate = { usd_ngn: 1600, updated_at: new Date() };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const result = await service.swap({
      wallet: '0x049',
      token_in: 'adusd',
      amount_in: '1000000000000000000',
      token_out: 'adngn',
      min_amount_out: '1590000000000000000',
      commitment: '0xabc',
    } as any);

    expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'swap',
          commitment: '0xabc',
        }),
      }),
    );

    expect(mockQueue.add).toHaveBeenCalledWith(
      'submit-swap',
      expect.objectContaining({ commitment: '0xabc' }),
      expect.any(Object),
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    expect((result as any).status).toBe('pending');
  });
});
