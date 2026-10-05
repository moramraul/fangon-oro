import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { User } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PasswordRecoveryService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async forgot(email: string) {
    const message =
      'Si existe una cuenta activa con ese correo, recibirás un enlace para restablecer tu contraseña.';
    const frontend = this.config.get<string>('FRONTEND_URL');
    if (this.config.get<string>('MAIL_ENABLED') !== 'true' || !frontend)
      return { message };
    const token = randomBytes(32).toString('hex');
    const now = new Date();
    const user = await this.users
      .findOneAndUpdate(
        {
          email: email.trim().toLowerCase(),
          isActive: true,
          passwordHash: { $type: 'string', $ne: '' },
          $or: [
            { passwordResetRequestedAt: { $exists: false } },
            {
              passwordResetRequestedAt: {
                $lte: new Date(now.getTime() - 60000),
              },
            },
          ],
        },
        {
          $set: {
            passwordResetTokenHash: createHash('sha256')
              .update(token)
              .digest('hex'),
            passwordResetExpiresAt: new Date(now.getTime() + 30 * 60000),
            passwordResetRequestedAt: now,
          },
        },
        { new: true },
      )
      .exec();
    if (user) {
      const url = new URL(frontend);
      url.hash = `/reset-password?token=${token}`;
      await this.notifications.passwordRecovery(user, url.toString());
    }
    return { message };
  }

  async reset(token: string, password: string) {
    if (Buffer.byteLength(password, 'utf8') > 72)
      throw new BadRequestException('La contraseña no puede superar 72 bytes.');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.users
      .findOneAndUpdate(
        {
          passwordResetTokenHash: createHash('sha256')
            .update(token)
            .digest('hex'),
          passwordResetExpiresAt: { $gt: new Date() },
          isActive: true,
        },
        {
          $set: { passwordHash, passwordPromptSeen: true },
          $inc: { sessionVersion: 1 },
          $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
        },
      )
      .exec();
    if (!user)
      throw new BadRequestException(
        'El enlace no es válido o ha caducado. Solicita uno nuevo.',
      );
    return { message: 'Contraseña actualizada. Ya puedes iniciar sesión.' };
  }
}
