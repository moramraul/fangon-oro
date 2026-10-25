import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createTransport, Transporter } from 'nodemailer';
import { User } from '../users/schemas/user.schema';
import { escapeHtml, mailTemplate } from './mail-template';
import { join } from 'node:path';

export interface EventInvitation {
  isTest?: boolean;
  _id: Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transport?: Transporter;
  private readonly from?: string;
  private readonly frontendUrl?: string;

  constructor(
    private readonly config: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {
    if (config.get<string>('MAIL_ENABLED') !== 'true') return;
    const host = config.get<string>('SMTP_HOST');
    const port = Number(config.get<string>('SMTP_PORT') ?? '587');
    const secureValue = config.get<string>('SMTP_SECURE') ?? 'false';
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASSWORD');
    this.from = config.get<string>('MAIL_FROM');
    this.frontendUrl = config.get<string>('FRONTEND_URL');
    if (
      !host ||
      !this.from ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      !['true', 'false'].includes(secureValue) ||
      Boolean(user) !== Boolean(pass)
    ) {
      throw new Error(
        'Invalid mail configuration: check SMTP_HOST, SMTP_PORT, SMTP_SECURE, MAIL_FROM and SMTP credentials',
      );
    }
    if (this.frontendUrl) {
      const url = new URL(this.frontendUrl);
      if (!['http:', 'https:'].includes(url.protocol))
        throw new Error('FRONTEND_URL must be an HTTP(S) URL');
    }
    this.transport = createTransport({
      host,
      port,
      secure: secureValue === 'true',
      ...(user && pass ? { auth: { user, pass } } : {}),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      dnsTimeout: 10000,
    });
  }

  async eventIncluded(
    event: EventInvitation,
    participantIds: Types.ObjectId[],
  ): Promise<void> {
    const transport = this.transport;
    if (event.isTest || !transport || !participantIds.length) return;
    // Mail failures never undo a successfully saved event or participant list.
    try {
      const recipients = await this.userModel
        .find({ _id: { $in: participantIds } })
        .select('_id name email')
        .exec();
      const dates = new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Europe/Madrid',
      });
      for (let offset = 0; offset < recipients.length; offset += 5) {
        await Promise.all(
          recipients.slice(offset, offset + 5).map(async (recipient) => {
            try {
              const votingPeriod = `Las votaciones permanecerán abiertas entre ${dates.format(event.startDate)} y ${dates.format(event.endDate)} (horario de Madrid, Europe/Madrid).`;
              const votingRules =
                'Podrás votar una sola vez, repartiendo 5, 3 y 1 punto entre otros tres participantes distintos. No podrás votarte a ti mismo. Una vez votes, no podrás volver atrás ni editar tu voto. ¡No te precipites!';
              const closingRules =
                'El evento se cerrará cuando llegue la fecha límite, hayan votado todos los participantes o lo cierre el administrador, lo que ocurra primero. La clasificación se podrá consultar a partir de ese momento.';
              await transport.sendMail({
                from: this.from,
                attachments: [
                  {
                    filename: 'emblema.png',
                    path: join(__dirname, 'assets/emblema.png'),
                    cid: 'fangon-emblema',
                  },
                ],
                to: { name: recipient.name, address: recipient.email },
                subject: `Has sido incluido en el evento: ${event.name.replace(/[\r\n]/g, ' ')}`,
                html: mailTemplate(
                  'Fangón, tienes una cita.',
                  `<p>Hola ${escapeHtml(recipient.name)},</p><p>Has sido incluido en el evento <strong>${escapeHtml(event.name)}</strong>.</p><table role="presentation" width="100%" style="border:1px solid #6e542c;text-align:left"><tr><td style="padding:20px">${escapeHtml(votingPeriod)}</td></tr></table><p>${escapeHtml(votingRules)}</p><p>${escapeHtml(closingRules)}</p><p style="color:#e8b954;font-weight:bold">Suerte, fangón.</p>`,
                  this.frontendUrl
                    ? `${this.frontendUrl.split('#')[0]}#/events`
                    : undefined,
                ),
                text: [
                  `Hola ${recipient.name},`,
                  '',
                  `Has sido incluido en el evento «${event.name}».`,
                  '',
                  votingPeriod,
                  '',
                  votingRules,
                  '',
                  closingRules,
                  '',
                  'Suerte, fangón.',
                  '',
                  this.frontendUrl
                    ? `Accede a la aplicación para consultar el evento y votar: ${this.frontendUrl}`
                    : 'Accede a la aplicación para consultar el evento y votar.',
                ].join('\n'),
              });
            } catch (error: unknown) {
              const smtpError = error as {
                code?: unknown;
                responseCode?: unknown;
                command?: unknown;
              } | null;
              const code = String(smtpError?.code ?? 'UNKNOWN');
              const command = String(smtpError?.command ?? 'UNKNOWN');
              const responseCode = smtpError?.responseCode;
              const diagnostics = [
                `code=${/^[A-Z0-9_]+$/.test(code) ? code : 'UNKNOWN'}`,
                `command=${/^[A-Z0-9 _-]+$/.test(command) ? command : 'UNKNOWN'}`,
                ...(typeof responseCode === 'number' &&
                Number.isInteger(responseCode)
                  ? [`responseCode=${responseCode}`]
                  : []),
              ].join(' ');
              this.logger.error(
                `Event inclusion email failed: event=${event._id.toHexString()} user=${recipient._id.toHexString()} ${diagnostics}`,
              );
            }
          }),
        );
      }
    } catch {
      this.logger.error(
        `Event inclusion notifications failed: event=${event._id.toHexString()}`,
      );
    }
  }
  async accountActivated(user: { name: string; email: string }): Promise<void> {
    if (!this.transport) return;
    const url = this.frontendUrl
      ? `${this.frontendUrl.split('#')[0]}#/login`
      : undefined;
    try {
      await this.transport.sendMail({
        from: this.from,
        to: { name: user.name, address: user.email },
        subject: 'Tu cuenta ya está activa · Fangón de Oro',
        attachments: [
          {
            filename: 'emblema.png',
            path: join(__dirname, 'assets/emblema.png'),
            cid: 'fangon-emblema',
          },
        ],
        text: [
          `Hola ${user.name},`,
          '',
          'El administrador ha activado tu cuenta. Ya puedes iniciar sesión en Fangón de Oro.',
          ...(url ? ['', `Inicia sesión: ${url}`] : []),
        ].join('\n'),
        html: mailTemplate(
          'Tu cuenta ya está activa.',
          `<p>Hola ${escapeHtml(user.name)},</p><p>El administrador ha activado tu cuenta.</p><p>Ya puedes iniciar sesión en Fangón de Oro.</p>`,
          url,
          'INICIAR SESIÓN',
        ),
      });
    } catch {
      this.logger.error('Account activation email failed');
    }
  }

  async passwordRecovery(user: { name: string; email: string }, url: string) {
    if (!this.transport) return;
    try {
      await this.transport.sendMail({
        from: this.from,
        attachments: [
          {
            filename: 'emblema.png',
            path: join(__dirname, 'assets/emblema.png'),
            cid: 'fangon-emblema',
          },
        ],
        to: { name: user.name, address: user.email },
        subject: 'Restablece tu contraseña · Fangón de Oro',
        text: `Hola ${user.name},\n\nRestablece tu contraseña: ${url}\n\nEl enlace caduca en 30 minutos y solo se puede usar una vez. Si no lo has solicitado, ignora este correo.`,
        html: mailTemplate(
          'Vuelve a los premios.',
          `<p>Hola ${escapeHtml(user.name)},</p><p>Has solicitado restablecer tu contraseña.</p><p>Este enlace caduca en <strong>30 minutos</strong> y solo se puede usar una vez.</p><p style="color:#aaa08d">Si no lo has solicitado, ignora este correo. Tu contraseña seguirá siendo la misma.</p>`,
          url,
          'RESTABLECER CONTRASEÑA',
        ),
      });
    } catch {
      this.logger.error('Password recovery email failed');
    }
  }
}
