import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/types/auth-user.type';
import { MeetTokenQueryDto } from './dto/meet-token-query.dto';
import { MeetService } from './meet.service';

@Controller('meet')
@UseGuards(JwtAuthGuard)
export class MeetController {
  constructor(private readonly meetService: MeetService) {}

  @Get('token')
  getToken(@CurrentUser() user: AuthUser, @Query() query: MeetTokenQueryDto) {
    return this.meetService.issueToken(user, query.room);
  }
}
