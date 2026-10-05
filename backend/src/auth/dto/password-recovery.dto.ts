import { IsEmail, IsHexadecimal, Length } from 'class-validator';
import { CreatePasswordDto } from './create-password.dto';

export class ForgotPasswordDto {
  @IsEmail()
  @Length(1, 254)
  email!: string;
}

export class ResetPasswordDto extends CreatePasswordDto {
  @IsHexadecimal()
  @Length(64, 64)
  token!: string;
}
