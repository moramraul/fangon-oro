import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { EventStatus } from '../schemas/event.schema';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateEventDto {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  date?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class CreateEventDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  date!: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayUnique((value: unknown) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsMongoId({ each: true })
  participantIds?: string[];
}

export class SetParticipantsDto {
  @IsArray()
  @ArrayUnique((value: unknown) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsMongoId({ each: true })
  participantIds!: string[];
}

export class SetEventStatusDto {
  @IsEnum(EventStatus)
  status!: EventStatus;
}
