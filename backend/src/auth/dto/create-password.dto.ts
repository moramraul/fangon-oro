import { IsString, Length } from 'class-validator';

export class CreatePasswordDto {
  @IsString()
  @Length(8, 72)
  password!: string;
}
