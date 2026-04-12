import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { DateTime } from 'luxon';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../app.module';
import { TeamsService } from '../modules/teams/teams.service';
import { UsersService } from '../modules/users/users.service';
import { User, UserDocument } from '../modules/users/schemas/user.schema';

const requireEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const parseEnrollYear = (studentId?: string) => {
  const raw =
    process.env.BOOTSTRAP_ADMIN_ENROLL_YEAR?.trim() ??
    (studentId ? studentId.slice(0, 4) : `${DateTime.now().setZone('Asia/Shanghai').year}`);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error('BOOTSTRAP_ADMIN_ENROLL_YEAR must be a valid year');
  }
  return parsed;
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const username = requireEnv('BOOTSTRAP_ADMIN_USERNAME').toLowerCase();
    const password = requireEnv('BOOTSTRAP_ADMIN_PASSWORD');
    const displayName = process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim() || username;
    const realName = process.env.BOOTSTRAP_ADMIN_REAL_NAME?.trim();
    const studentId = process.env.BOOTSTRAP_ADMIN_STUDENT_ID?.trim();
    const resetPassword = process.env.BOOTSTRAP_ADMIN_RESET_PASSWORD === 'true';

    if (password.length < 6) {
      throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 6 characters');
    }

    if (studentId && !/^\d{12}$/.test(studentId)) {
      throw new Error('BOOTSTRAP_ADMIN_STUDENT_ID must be exactly 12 digits when provided');
    }

    const enrollYear = parseEnrollYear(studentId);
    const configService = app.get(ConfigService);
    const teamsService = app.get(TeamsService);
    const usersService = app.get(UsersService);
    const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    const defaultTeamName = configService.get<string>('DEFAULT_TEAM_NAME', 'FocusTeam');
    const team = await teamsService.ensureDefaultTeam(defaultTeamName);
    const existing = await usersService.findByUsername(username);

    if (existing) {
      const set: Partial<User> & { passwordHash?: string } = {
        displayName,
        role: 'admin',
        status: 'active',
        teamId: team.id,
        enrollYear
      };

      if (realName) {
        set.realName = realName;
      }

      if (studentId) {
        set.studentId = studentId;
      }

      if (resetPassword) {
        set.passwordHash = await bcrypt.hash(password, 10);
      }

      const updated = await userModel.findByIdAndUpdate(existing.id, { $set: set }, { new: true }).exec();

      if (!updated) {
        throw new Error(`Failed to update existing user ${username}`);
      }

      console.log(
        `Promoted existing user ${updated.username} to admin for team ${defaultTeamName}` +
          (resetPassword ? ' and reset the password' : '')
      );
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await usersService.create({
      username,
      passwordHash,
      displayName,
      teamId: team.id,
      role: 'admin',
      enrollYear,
      realName,
      studentId
    });

    console.log(`Created admin user ${created.username} for team ${defaultTeamName}`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
