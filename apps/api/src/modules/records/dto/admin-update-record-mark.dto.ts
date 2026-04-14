import { IsBoolean } from 'class-validator';

export class AdminUpdateRecordMarkDto {
  @IsBoolean()
  isMarked!: boolean;
}
