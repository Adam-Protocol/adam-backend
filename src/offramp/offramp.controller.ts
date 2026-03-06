import { Body, Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { FlutterwaveService } from './flutterwave.service';

@ApiTags('offramp')
@Controller('offramp')
export class OfframpController {
  constructor(private readonly flutterwaveService: FlutterwaveService) {}

  @Get('status/:referenceId')
  @ApiOperation({ summary: 'Get offramp transaction status' })
  @ApiParam({ name: 'referenceId', description: 'Flutterwave reference ID' })
  getStatus(@Param('referenceId') referenceId: string) {
    return this.flutterwaveService.getStatus(referenceId);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Flutterwave payment webhook (internal)' })
  handleWebhook(
    @Body() payload: any,
    @Headers('verif-hash') signature: string,
  ) {
    return this.flutterwaveService.handleWebhook(payload, signature);
  }


  @Get('banks/:country')
  @ApiOperation({ summary: 'Get list of banks for a country' })
  @ApiParam({ name: 'country', description: 'Country code (e.g., NG, US)', example: 'NG' })
  getBanks(@Param('country') country: string) {
    return this.flutterwaveService.getBanks(country);
  }

  @Post('verify-account')
  @ApiOperation({ summary: 'Verify bank account and get account name' })
  verifyAccount(
    @Body() body: { account_number: string; bank_code: string },
  ) {
    return this.flutterwaveService.verifyAccount(body.account_number, body.bank_code);
  }

}
