import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Transaction } from '@prisma/client';

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async updateStatus(
    id: string,
    status: TransactionStatus,
    extra?: { tx_hash?: string; reference_id?: string; error?: string },
  ): Promise<Transaction> {
    const tx = await this.prisma.transaction.update({
      where: { id },
      data: { status, ...extra },
    });
    this.logger.log(`Transaction ${id} → ${status}${extra?.tx_hash ? ` (tx: ${extra.tx_hash})` : ''}`);
    return tx;
  }

  async findByCommitment(commitment: string): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({ where: { commitment } });
  }

  async findByNullifier(nullifier: string): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({ where: { nullifier } });
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({ where: { id } });
  }
}
