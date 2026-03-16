import { Controller, Post, Get, Body, Query, Logger } from '@nestjs/common';
import { PrivacyService } from './privacy.service';
import { ZkProofService } from './zk-proof.service';
import { StealthService, ViewKey } from './stealth.service';

@Controller('privacy')
export class PrivacyController {
  private readonly logger = new Logger(PrivacyController.name);

  constructor(
    private readonly privacyService: PrivacyService,
    private readonly zkProofService: ZkProofService,
    private readonly stealthService: StealthService,
  ) {}

  @Post('commitment/generate')
  async generateCommitment(
    @Body() body: { amount: string; blindingFactor?: string },
  ) {
    try {
      const amount = BigInt(body.amount);
      const blindingFactor = body.blindingFactor
        ? BigInt(body.blindingFactor)
        : undefined;

      const result = this.privacyService.generateCommitment(
        amount,
        blindingFactor,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Failed to generate commitment', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('commitment/verify')
  async verifyCommitment(
    @Body()
    body: {
      commitment: string;
      amount: string;
      blindingFactor: string;
    },
  ) {
    try {
      const amount = BigInt(body.amount);
      const blindingFactor = BigInt(body.blindingFactor);

      const isValid = this.privacyService.verifyCommitment(
        body.commitment,
        amount,
        blindingFactor,
      );

      return {
        success: true,
        data: { isValid },
      };
    } catch (error) {
      this.logger.error('Failed to verify commitment', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('nullifier/derive')
  async deriveNullifier(
    @Body() body: { commitment: string; secret: string },
  ) {
    try {
      const nullifier = this.privacyService.deriveNullifier(
        body.commitment,
        body.secret,
      );

      return {
        success: true,
        data: { nullifier },
      };
    } catch (error) {
      this.logger.error('Failed to derive nullifier', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('proof/range')
  async generateRangeProof(
    @Body()
    body: {
      commitment: string;
      amount: string;
      blindingFactor: string;
    },
  ) {
    try {
      const amount = BigInt(body.amount);

      const proof = await this.zkProofService.generateRangeProof(
        body.commitment,
        amount,
        body.blindingFactor,
      );

      return {
        success: true,
        data: proof,
      };
    } catch (error) {
      this.logger.error('Failed to generate range proof', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('proof/verify')
  async verifyRangeProof(
    @Body()
    body: {
      commitment: string;
      proofA: string;
      proofB: string;
      proofC: string;
    },
  ) {
    try {
      const isValid = await this.zkProofService.verifyRangeProof(body);

      return {
        success: true,
        data: { isValid },
      };
    } catch (error) {
      this.logger.error('Failed to verify range proof', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('stealth/generate')
  async generateStealthAddress(
    @Body() body: { recipientPubkey: string; ephemeralSecret?: string },
  ) {
    try {
      const stealthAddress = this.stealthService.generateStealthAddress(
        body.recipientPubkey,
        body.ephemeralSecret,
      );

      return {
        success: true,
        data: stealthAddress,
      };
    } catch (error) {
      this.logger.error('Failed to generate stealth address', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('stealth/scan')
  async scanTransactions(
    @Body()
    body: {
      stealthAddresses: Array<{
        address: string;
        ephemeralPubkey: string;
      }>;
      viewKey: ViewKey;
    },
  ) {
    try {
      const myAddresses = await this.stealthService.scanTransactions(
        body.stealthAddresses,
        body.viewKey,
      );

      return {
        success: true,
        data: {
          found: myAddresses.length,
          addresses: myAddresses,
        },
      };
    } catch (error) {
      this.logger.error('Failed to scan transactions', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('stealth/viewkey')
  async generateViewKey() {
    try {
      const viewKey = this.stealthService.generateViewKey();

      return {
        success: true,
        data: viewKey,
      };
    } catch (error) {
      this.logger.error('Failed to generate view key', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('encrypt')
  async encryptData(
    @Body()
    body: {
      data: string;
      recipientPubkey: string;
      ephemeralSecret: string;
    },
  ) {
    try {
      const encrypted = this.stealthService.encryptData(
        body.data,
        body.recipientPubkey,
        body.ephemeralSecret,
      );

      return {
        success: true,
        data: { encrypted },
      };
    } catch (error) {
      this.logger.error('Failed to encrypt data', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('decrypt')
  async decryptData(
    @Body()
    body: {
      encryptedData: string;
      ephemeralPubkey: string;
      viewKey: ViewKey;
    },
  ) {
    try {
      const decrypted = this.stealthService.decryptData(
        body.encryptedData,
        body.ephemeralPubkey,
        body.viewKey,
      );

      return {
        success: true,
        data: { decrypted },
      };
    } catch (error) {
      this.logger.error('Failed to decrypt data', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
