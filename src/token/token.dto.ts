import {
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SUPPORTED_CHAINS = ['STARKNET', 'STACKS'] as const;
export type SupportedChain = typeof SUPPORTED_CHAINS[number];

export class BuyTokenDto {
  @ApiPropertyOptional({
    description: 'Custom transaction ID (optional)',
    example: 'tx_abc123',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({ description: 'Wallet address (format depends on chain)', example: '0x049...' })
  @IsString()
  wallet: string;

  @ApiProperty({
    description: 'USDC amount in wei (6 decimals)',
    example: '5000000',
  })
  @IsNumberString()
  amount_in: string;

  @ApiProperty({
    description: 'Token to receive: adusd, adngn, adkes, adghs, or adzar',
    enum: ['adusd', 'adngn', 'adkes', 'adghs', 'adzar'],
  })
  @IsIn(['adusd', 'adngn', 'adkes', 'adghs', 'adzar'])
  token_out: 'adusd' | 'adngn' | 'adkes' | 'adghs' | 'adzar';

  @ApiPropertyOptional({
    description: 'Pedersen commitment hash (computed client-side)',
    example: '0x...',
  })
  @IsOptional()
  @IsString()
  commitment?: string;

  @ApiPropertyOptional({
    description: 'Transaction hash (if already executed on frontend)',
    example: '0x...',
  })
  @IsOptional()
  @IsString()
  tx_hash?: string;

  @ApiPropertyOptional({
    description: 'Source chain. Defaults to STARKNET.',
    enum: ['STARKNET', 'STACKS'],
    default: 'STARKNET',
  })
  @IsOptional()
  @IsIn(['STARKNET', 'STACKS'])
  chain?: SupportedChain;
}

export class SellTokenDto {
  @ApiPropertyOptional({
    description: 'Custom transaction ID (optional)',
    example: 'tx_abc123',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({ description: 'Wallet address (format depends on chain)', example: '0x049...' })
  @IsString()
  wallet: string;

  @ApiProperty({
    description: 'Token to sell: adusd, adngn, adkes, adghs, or adzar',
    enum: ['adusd', 'adngn', 'adkes', 'adghs', 'adzar'],
  })
  @IsIn(['adusd', 'adngn', 'adkes', 'adghs', 'adzar'])
  token_in: 'adusd' | 'adngn' | 'adkes' | 'adghs' | 'adzar';

  @ApiProperty({
    description: 'Amount to sell in wei (18 decimals)',
    example: '1000000000000000000',
  })
  @IsNumberString()
  amount: string;

  @ApiPropertyOptional({
    description: 'Nullifier hash (computed client-side)',
    example: '0x...',
  })
  @IsOptional()
  @IsString()
  nullifier?: string;

  @ApiPropertyOptional({
    description: 'Commitment hash (computed client-side)',
    example: '0x...',
  })
  @IsOptional()
  @IsString()
  commitment?: string;

  @ApiProperty({ description: 'Target currency', enum: ['NGN', 'USD', 'KES', 'GHS', 'ZAR'] })
  @IsIn(['NGN', 'USD', 'KES', 'GHS', 'ZAR'])
  currency: 'NGN' | 'USD' | 'KES' | 'GHS' | 'ZAR';

  @ApiProperty({ description: 'Bank account number', example: '0123456789' })
  @IsString()
  @Length(10, 10)
  bank_account: string;

  @ApiProperty({ description: 'Bank code', example: '044' })
  @IsString()
  bank_code: string;

  @ApiPropertyOptional({
    description: 'Transaction hash (if already executed on frontend)',
    example: '0x...',
  })
  @IsOptional()
  @IsString()
  tx_hash?: string;

  @ApiPropertyOptional({
    description: 'Source chain. Defaults to STARKNET.',
    enum: ['STARKNET', 'STACKS'],
    default: 'STARKNET',
  })
  @IsOptional()
  @IsIn(['STARKNET', 'STACKS'])
  chain?: SupportedChain;
}
