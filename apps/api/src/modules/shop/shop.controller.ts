import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { UnlockSkinDto } from './dto/unlock-skin.dto';
import { ShopService } from './shop.service';

@Controller('shop')
@UseGuards(JwtAuthGuard)
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get('unlocks')
  getUnlocks(@CurrentUser() user: AuthUser) {
    return this.shopService.getUnlocks(user);
  }

  @Post('unlock')
  unlock(@CurrentUser() user: AuthUser, @Body() input: UnlockSkinDto) {
    return this.shopService.unlock(user, input.skinId);
  }
}
