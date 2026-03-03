import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OfframpService {
  private readonly logger = new Logger(OfframpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue('offramp') private readonly offrampQueue: Queue,
  ) {}

  /** Get status of an offramp request */
  async getStatus(referenceId: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: { reference_id: referenceId },
      select: {
        id: true,
        status: true,
        type: true,
        currency: true,
        token_in: true,
        token_out: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  /** Monnify webhook — called when bank transfer is confirmed */
  async handleWebhook(payload: any) {
    this.logger.log(`Offramp webhook received: ${payload.transactionReference}`);

    const tx = await this.prisma.transaction.findFirst({
      where: { reference_id: payload.transactionReference },
    });

    if (!tx) {
      this.logger.warn(`No transaction for reference ${payload.transactionReference}`);
      return { received: true };
    }

    if (payload.paymentStatus === 'PAID') {
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'completed' },
      });
      this.logger.log(`Transaction ${tx.id} completed`);
    } else if (payload.paymentStatus === 'FAILED') {
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'failed', error: payload.message ?? 'Payment failed' },
      });
    }

    return { received: true };
  }

  /** Trigger a Monnify bank transfer — called by the queue processor after on-chain sell succeeds */
  async initiateBankTransfer(params: {
    transactionId: string;
    amount: number;
    currency: string;
    bank_account: string;
    bank_code: string;
    narration: string;
  }) {
    const { transactionId, amount, currency, bank_account, bank_code, narration } = params;

    const monnifyUrl = `${this.config.get('MONNIFY_BASE_URL')}/api/v2/disbursements/single`;
    const reference = `ADAM-${transactionId}-${Date.now()}`;

    const response = await axios.post(
      monnifyUrl,
      {
        amount,
        reference,
        narration,
        destinationBankCode: bank_code,
        destinationAccountNumber: bank_account,
        currency,
        sourceAccountNumber: this.config.get('MONNIFY_CONTRACT_CODE'),
      },
      {
        auth: {
          username: this.config.get<string>('MONNIFY_API_KEY') || '',
          password: this.config.get<string>('MONNIFY_SECRET_KEY') || '',
        },
      },
    );

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { reference_id: reference, status: 'processing' },
    });

    this.logger.log(`Bank transfer initiated: ${reference}`);
    return response.data;
  }
}
