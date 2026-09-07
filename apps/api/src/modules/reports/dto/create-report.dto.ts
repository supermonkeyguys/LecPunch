import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  description!: string;
}
