import { Injectable, Logger } from '@nestjs/common';
import { hash, ec } from 'starknet';

export interface StealthAddress {
  address: string;
  ephemeralPubkey: string;
  encryptedData?: string;
}

export interface ViewKey {
  scanKey: string;
  spendKey: string;
}

@Injectable()
export class StealthService {
  private readonly logger = new Logger(StealthService.name);

  /**
   * Generate a stealth address for recipient privacy
   * Allows one-time addresses for each transaction
   */
  generateStealthAddress(
    recipientPubkey: string,
    ephemeralSecret?: string,
  ): StealthAddress {
    try {
      // Generate ephemeral secret if not provided
      const ephSecret = ephemeralSecret || this.generateEphemeralSecret();

      // Derive ephemeral public key
      const ephemeralPubkey = this.derivePublicKey(ephSecret);

      // Compute shared secret using ECDH
      const sharedSecret = this.computeSharedSecret(recipientPubkey, ephSecret);

      // Derive stealth address from shared secret
      const address = this.deriveAddress(sharedSecret);

      this.logger.debug('Generated stealth address');

      return {
        address,
        ephemeralPubkey,
      };
    } catch (error) {
      this.logger.error('Failed to generate stealth address', error);
      throw error;
    }
  }

  /**
   * Check if a stealth address belongs to the view key holder
   * Used for scanning incoming transactions
   */
  isMine(
    stealthAddress: string,
    ephemeralPubkey: string,
    viewKey: ViewKey,
  ): boolean {
    try {
      // Compute shared secret using view key
      const sharedSecret = this.computeSharedSecret(
        ephemeralPubkey,
        viewKey.scanKey,
      );

      // Derive expected address
      const expectedAddress = this.deriveAddress(sharedSecret);

      return stealthAddress === expectedAddress;
    } catch (error) {
      this.logger.error('Failed to check stealth address ownership', error);
      return false;
    }
  }

  /**
   * Derive spending key for a stealth address
   * Allows recipient to spend funds sent to stealth address
   */
  deriveSpendingKey(ephemeralPubkey: string, viewKey: ViewKey): string {
    try {
      // Compute shared secret
      const sharedSecret = this.computeSharedSecret(
        ephemeralPubkey,
        viewKey.scanKey,
      );

      // Derive spending key using Poseidon
      const spendingKey = hash.computePoseidonHash(viewKey.spendKey, sharedSecret);

      return spendingKey;
    } catch (error) {
      this.logger.error('Failed to derive spending key', error);
      throw error;
    }
  }

  /**
   * Encrypt data for recipient
   * Used for encrypted memos or metadata
   */
  encryptData(
    data: string,
    recipientPubkey: string,
    ephemeralSecret: string,
  ): string {
    try {
      const sharedSecret = this.computeSharedSecret(
        recipientPubkey,
        ephemeralSecret,
      );

      // Derive encryption key from shared secret using Poseidon
      const encryptionKey = hash.computePoseidonHash(sharedSecret, '0x1');

      // Simple XOR encryption (in production, use proper encryption)
      const dataNum = BigInt(data);
      const keyNum = BigInt(encryptionKey);
      const encrypted = (dataNum ^ keyNum).toString(16);

      return '0x' + encrypted;
    } catch (error) {
      this.logger.error('Failed to encrypt data', error);
      throw error;
    }
  }

  /**
   * Decrypt data using view key
   */
  decryptData(
    encryptedData: string,
    ephemeralPubkey: string,
    viewKey: ViewKey,
  ): string {
    try {
      const sharedSecret = this.computeSharedSecret(
        ephemeralPubkey,
        viewKey.scanKey,
      );

      // Derive encryption key using Poseidon
      const encryptionKey = hash.computePoseidonHash(sharedSecret, '0x1');

      // XOR to decrypt
      const encryptedNum = BigInt(encryptedData);
      const keyNum = BigInt(encryptionKey);
      const decrypted = (encryptedNum ^ keyNum).toString(16);

      return '0x' + decrypted;
    } catch (error) {
      this.logger.error('Failed to decrypt data', error);
      throw error;
    }
  }

  /**
   * Scan transactions for incoming stealth payments
   * Returns list of stealth addresses that belong to the view key holder
   */
  async scanTransactions(
    stealthAddresses: StealthAddress[],
    viewKey: ViewKey,
  ): Promise<StealthAddress[]> {
    try {
      this.logger.debug(`Scanning ${stealthAddresses.length} transactions`);

      const myAddresses: StealthAddress[] = [];

      for (const addr of stealthAddresses) {
        if (this.isMine(addr.address, addr.ephemeralPubkey, viewKey)) {
          myAddresses.push(addr);
        }
      }

      this.logger.debug(`Found ${myAddresses.length} incoming transactions`);
      return myAddresses;
    } catch (error) {
      this.logger.error('Failed to scan transactions', error);
      throw error;
    }
  }

  /**
   * Generate view key pair for stealth address system
   */
  generateViewKey(): ViewKey {
    try {
      const scanKey = this.generateEphemeralSecret();
      const spendKey = this.generateEphemeralSecret();

      return {
        scanKey,
        spendKey,
      };
    } catch (error) {
      this.logger.error('Failed to generate view key', error);
      throw error;
    }
  }

  // Private helper methods

  private generateEphemeralSecret(): string {
    const randomBytes = ec.starkCurve.utils.randomPrivateKey();
    return '0x' + Buffer.from(randomBytes).toString('hex');
  }

  private derivePublicKey(secret: string): string {
    // In production, use proper elliptic curve point multiplication
    // pubkey = secret * G (generator point)
    // For now, use Poseidon hash as placeholder
    return hash.computePoseidonHash(secret, '0x' + Buffer.from('PUBKEY').toString('hex'));
  }

  private computeSharedSecret(pubkey: string, secret: string): string {
    // In production, use ECDH: shared_secret = secret * pubkey
    // For now, use Poseidon hash combination
    return hash.computePoseidonHash(pubkey, secret);
  }

  private deriveAddress(sharedSecret: string): string {
    // Derive address from shared secret using Poseidon
    const addressHash = hash.computePoseidonHash(
      sharedSecret,
      '0x' + Buffer.from('STEALTH').toString('hex'),
    );
    return addressHash;
  }
}
