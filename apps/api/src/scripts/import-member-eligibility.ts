import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { TeamsService } from '../modules/teams/teams.service';
import { MemberEligibilityDocument, MemberEligibility } from '../modules/member-eligibility/schemas/member-eligibility.schema';
import {
  normalizeEligibilityNote,
  normalizeEligibilityRealName,
  normalizeEligibilityStatus,
  normalizeEligibilityStudentId
} from '../modules/member-eligibility/member-eligibility.normalization';

type EligibilityImportRow = {
  studentId: string;
  realName: string;
  status?: string;
  note?: string;
};

const REQUIRED_COLUMNS = ['studentId', 'realName'] as const;
const OPTIONAL_COLUMNS = ['status', 'note'] as const;
const ALLOWED_COLUMNS: Set<string> = new Set([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]);

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const parseCsvRows = (text: string): EligibilityImportRow[] => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV must include a header row and at least one data row');
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  for (const requiredColumn of REQUIRED_COLUMNS) {
    if (!headers.includes(requiredColumn)) {
      throw new Error(`CSV header missing required column: ${requiredColumn}`);
    }
  }

  for (const header of headers) {
    if (!ALLOWED_COLUMNS.has(header)) {
      throw new Error(`Unsupported CSV column: ${header}`);
    }
  }

  return lines.slice(1).map((line, idx) => {
    const values = parseCsvLine(line);
    const row = headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = values[index] ?? '';
      return acc;
    }, {});

    if (!row.studentId || !row.realName) {
      throw new Error(`CSV row ${idx + 2} missing studentId or realName`);
    }

    return {
      studentId: row.studentId,
      realName: row.realName,
      status: row.status || undefined,
      note: row.note || undefined
    };
  });
};

const parseJsonRows = (text: string): EligibilityImportRow[] => {
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('JSON must be an array');
  }

  return parsed.map((item, idx) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`JSON row ${idx + 1} must be an object`);
    }

    const row = item as Record<string, unknown>;
    if (typeof row.studentId !== 'string' || typeof row.realName !== 'string') {
      throw new Error(`JSON row ${idx + 1} must include string studentId and realName`);
    }

    return {
      studentId: row.studentId,
      realName: row.realName,
      status: typeof row.status === 'string' ? row.status : undefined,
      note: typeof row.note === 'string' ? row.note : undefined
    };
  });
};

const parseStatus = (statusRaw?: string) => {
  if (!statusRaw) {
    return normalizeEligibilityStatus(undefined);
  }

  const normalized = statusRaw.trim().toLowerCase();
  if (normalized !== 'allowed' && normalized !== 'blocked') {
    throw new Error(`Unsupported status: ${statusRaw}. Use allowed or blocked.`);
  }

  return normalizeEligibilityStatus(normalized);
};

const normalizeRows = (rows: EligibilityImportRow[]) =>
  rows.map((row, index) => {
    const studentId = normalizeEligibilityStudentId(row.studentId);
    const realName = normalizeEligibilityRealName(row.realName);
    const status = parseStatus(row.status);
    const note = normalizeEligibilityNote(row.note);

    if (!studentId || !realName) {
      throw new Error(`Row ${index + 1} has empty studentId or realName after normalization`);
    }

    return { studentId, realName, status, note };
  });

const loadRows = async (filePath: string) => {
  const absolutePath = path.resolve(filePath);
  const fileExt = path.extname(absolutePath).toLowerCase();
  const content = await readFile(absolutePath, 'utf8');

  if (fileExt === '.csv') {
    return normalizeRows(parseCsvRows(content));
  }
  if (fileExt === '.json') {
    return normalizeRows(parseJsonRows(content));
  }

  throw new Error(`Unsupported file extension: ${fileExt}. Use .csv or .json`);
};

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Usage: pnpm --filter @lecpunch/api import-eligibility -- <path-to-csv-or-json>');
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const rows = await loadRows(inputPath);
    const configService = app.get(ConfigService);
    const teamsService = app.get(TeamsService);
    const eligibilityModel = app.get<Model<MemberEligibilityDocument>>(getModelToken(MemberEligibility.name));

    const defaultTeamName = configService.get<string>('DEFAULT_TEAM_NAME', 'FocusTeam');
    const team = await teamsService.ensureDefaultTeam(defaultTeamName);

    for (const row of rows) {
      await eligibilityModel
        .findOneAndUpdate(
          { teamId: team.id, studentId: row.studentId },
          {
            $set: {
              teamId: team.id,
              studentId: row.studentId,
              realName: row.realName,
              status: row.status,
              note: row.note
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
        .exec();
    }

    console.log(
      `Imported ${rows.length} member-eligibility rows for team ${defaultTeamName} (${team.id}) from ${path.resolve(inputPath)}`
    );
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
