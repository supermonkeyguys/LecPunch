import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { PointsService } from './points.service';
import { MyPointsQueryDto } from './dto/my-points-query.dto';

@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthUser, @Query() query: MyPointsQueryDto) {
    return this.pointsService.getMyPoints(user, query.week);
  }
}
