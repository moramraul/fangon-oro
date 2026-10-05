import { IsBoolean } from 'class-validator';

export class UpdateActivationDto {
  @IsBoolean()
  isActive!: boolean;
}
