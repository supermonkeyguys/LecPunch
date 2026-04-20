import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TeamsService } from '../teams/teams.service';
import * as bcrypt from 'bcrypt';
import { ERROR_CODES, UserStatus } from '@lecpunch/shared';
import { AuthResponse, AuthUserResponse } from './dto/auth-response.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { MemberEligibilityService } from '../member-eligibility/member-eligibility.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly teamsService: TeamsService,
    private readonly memberEligibilityService: MemberEligibilityService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async register(payload: RegisterDto): Promise<AuthResponse> {
    const allowed = this.configService.get<boolean>('ALLOW_OPEN_REGISTRATION');
    if (!allowed) {
      throw new ForbiddenException({
        code: ERROR_CODES.AUTH_UNAUTHORIZED,
        message: 'Registration is disabled'
      });
    }

    const normalizedUsername = payload.username.trim().toLowerCase();
    const existing = await this.usersService.findByUsername(normalizedUsername);
    if (existing) {
      throw new ConflictException({
        code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        message: 'Username already in use'
      });
    }

    const existingByStudentId = await this.usersService.findByStudentId(payload.studentId);
    if (existingByStudentId) {
      throw new ConflictException({
        code: 'STUDENT_ID_TAKEN',
        message: 'Student ID already in use'
      });
    }

    const enrollYear = parseInt(payload.studentId.slice(0, 4), 10);
    const defaultTeamName = this.configService.get<string>('DEFAULT_TEAM_NAME', 'FocusTeam');
    const team = await this.teamsService.ensureDefaultTeam(defaultTeamName);
    await this.memberEligibilityService.assertEligible(team.id, payload.studentId, payload.realName);
    const passwordHash = await bcrypt.hash(payload.password, 10);

    const user = await this.usersService.create({
      username: normalizedUsername,
      passwordHash,
      displayName: payload.displayName.trim(),
      teamId: team.id,
      enrollYear,
      studentId: payload.studentId,
      realName: payload.realName.trim(),
    });

    return this.buildAuthResponse(user);
  }

  async login(payload: LoginDto): Promise<AuthResponse> {
    const normalizedUsername = payload.username.trim().toLowerCase();
    const user = await this.usersService.findByUsername(normalizedUsername);
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid username or password'
      });
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException({
        code: ERROR_CODES.USER_DISABLED,
        message: 'User disabled'
      });
    }

    const passwordValid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        message: 'Invalid username or password'
      });
    }

    return this.buildAuthResponse(user);
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_UNAUTHORIZED,
        message: 'User not found'
      });
    }
    return this.toUserResponse(user);
  }

  private buildAuthResponse(user: UserDocument): AuthResponse {
    const payload = {
      sub: user.id,
      teamId: user.teamId,
      role: user.role
    };

    const accessToken = this.jwtService.sign(payload);
    return {
      accessToken,
      user: this.toUserResponse(user)
    };
  }

  private toUserResponse(user: UserDocument): AuthUserResponse {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      teamId: user.teamId,
      role: user.role,
      status: user.status as UserStatus,
      enrollYear: user.enrollYear,
      studentId: user.studentId,
      realName: user.realName,
      avatarBase64: user.avatarBase64,
      avatarColor: user.avatarColor,
      avatarEmoji: user.avatarEmoji,
    };
  }
}
