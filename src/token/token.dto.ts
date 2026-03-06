import { IsEthereumAddress, IsIn, IsNumberString, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BuyTokenDto {
  @ApiPropertyOptional({ description: 'Custom transaction ID (optional)', example: 'tx_abc123' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({ description: 'Starknet wallet address', example: '0x049...' })
  @IsString()
  wallet: string;

  @ApiProperty({ description: 'USDC amount in wei (6 decimals)', example: '5000000' })
  @IsNumberString()
  amount_in: string;

  @ApiProperty({ description: 'Token to receive: adusd or adngn', enum: ['adusd', 'adngn'] })
  @IsIn(['adusd', 'adngn'])
  token_out: 'adusd' | 'adngn';

  @ApiProperty({ description: 'Pedersen commitment hash (computed client-side)', example: '0x...' })
  @IsString()
  commitment: string;

  @ApiPropertyOptional({ description: 'Transaction hash (if already executed on frontend)', example: '0x...' })
  @IsOptional()
  @IsString()
  tx_hash?: string;
}

export class SellTokenDto {
  @ApiPropertyOptional({ description: 'Custom transaction ID (optional)', example: 'tx_abc123' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({ description: 'Starknet wallet address', example: '0x049...' })
  @IsString()
  wallet: string;

  @ApiProperty({ description: 'Token to sell: adusd or adngn', enum: ['adusd', 'adngn'] })
  @IsIn(['adusd', 'adngn'])
  token_in: 'adusd' | 'adngn';

  @ApiProperty({ description: 'Amount to sell in wei (18 decimals)', example: '1000000000000000000' })
  @IsNumberString()
  amount: string;

  @ApiProperty({ description: 'Nullifier hash (computed client-side)', example: '0x...' })
  @IsString()
  nullifier: string;

  @ApiProperty({ description: 'Commitment hash (computed client-side)', example: '0x...' })
  @IsString()
  commitment: string;

  @ApiProperty({ description: 'Target currency', enum: ['NGN', 'USD'] })
  @IsIn(['NGN', 'USD'])
  currency: 'NGN' | 'USD';

  @ApiProperty({ description: 'Bank account number', example: '0123456789' })
  @IsString()
  @Length(10, 10)
  bank_account: string;

  @ApiProperty({ description: 'Bank code', example: '044' })
  @IsString()
  bank_code: string;
}
