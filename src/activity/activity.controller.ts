import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ActivityService } from './activity.service';

@ApiTags('activity')
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get(':wallet')
  @ApiOperation({ summary: 'Get transaction history for a wallet' })
  @ApiParam({ name: 'wallet', description: 'Starknet wallet address' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'type', required: false, enum: ['buy', 'sell', 'swap', 'all'] })
  getActivity(
    @Param('wallet') wallet: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('type') type = 'all',
  ) {
    return this.activityService.getActivity(wallet, {
      page: parseInt(page),
      limit: parseInt(limit),
      type,
    });
  }
}
