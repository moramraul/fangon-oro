import { Transform } from 'class-transformer';
import {
  IsString,
  Length,
  Matches,
  ValidateIf,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 80)
  name!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(90000)
  @Matches(/^(?:data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2})?$/)
  avatar?: string;
}
