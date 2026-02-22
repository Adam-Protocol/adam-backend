import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivity(
    wallet: string,
    opts: { page: number; limit: number; type: string },
  ) {
    const { page, limit, type } = opts;
    const skip = (page - 1) * limit;

    const where: any = { wallet };
    if (type !== 'all') where.type = type;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          type: true,
          token_in: true,
          token_out: true,
          status: true,
          tx_hash: true,
          reference_id: true,
          currency: true,
          created_at: true,
          updated_at: true,
          // Note: amount, bank_account NOT returned — privacy
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }
}
