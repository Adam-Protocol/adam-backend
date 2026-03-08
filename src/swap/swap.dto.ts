import { IsIn, IsNumberString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SwapDto {
  @ApiPropertyOptional({
    description: 'Custom transaction ID (optional)',
    example: 'tx_abc123',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiProperty({ example: '0x049...' })
  @IsString()
  wallet: string;

  @ApiProperty({ enum: ['adusd', 'adngn'] })
  @IsIn(['adusd', 'adngn'])
  token_in: 'adusd' | 'adngn';

  @ApiProperty({
    description: 'Amount in wei (18 decimals)',
    example: '1000000000000000000',
  })
  @IsNumberString()
  amount_in: string;

  @ApiProperty({ enum: ['adusd', 'adngn'] })
  @IsIn(['adusd', 'adngn'])
  token_out: 'adusd' | 'adngn';

  @ApiProperty({
    description: 'Min amount out (slippage protection)',
    example: '990000000000000000',
  })
  @IsNumberString()
  min_amount_out: string;

  @ApiProperty({
    description: 'Commitment hash (computed client-side)',
    example: '0x...',
  })
  @IsString()
  commitment: string;

  @ApiPropertyOptional({
    description: 'Transaction hash from frontend execution',
    example: '0x...',
  })
  @IsOptional()
  @IsString()
  tx_hash?: string;
}
