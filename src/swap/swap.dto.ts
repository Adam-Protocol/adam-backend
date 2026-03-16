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

  @ApiProperty({ enum: ['adusd', 'adngn', 'adkes', 'adghs', 'adzar'] })
  @IsIn(['adusd', 'adngn', 'adkes', 'adghs', 'adzar'])
  token_in: 'adusd' | 'adngn' | 'adkes' | 'adghs' | 'adzar';

  @ApiProperty({
    description: 'Amount in wei (18 decimals)',
    example: '1000000000000000000',
  })
  @IsNumberString()
  amount_in: string;

  @ApiProperty({ enum: ['adusd', 'adngn', 'adkes', 'adghs', 'adzar'] })
  @IsIn(['adusd', 'adngn', 'adkes', 'adghs', 'adzar'])
  token_out: 'adusd' | 'adngn' | 'adkes' | 'adghs' | 'adzar';

  @ApiProperty({
    description: 'Min amount out (slippage protection)',
    example: '990000000000000000',
  })
  @IsNumberString()
  min_amount_out: string;

  @ApiProperty({
    description: 'Nullifier hash of the spent note (computed client-side)',
    example: '0x...',
  })
  @IsString()
  nullifier: string;

  @ApiProperty({
    description: 'Commitment hash for the new note (computed client-side)',
    example: '0x...',
  })
  @IsString()
  commitment: string;

  @ApiProperty({
    description: 'Array of ZK proof elements',
    example: ['0x123...', '0x456...'],
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true })
  proof?: string[];

  @ApiPropertyOptional({
    description: 'Transaction hash from frontend execution',
    example: '0x...',
  })
  @IsOptional()
  @IsString()
  tx_hash?: string;
}
