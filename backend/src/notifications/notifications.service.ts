import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createTransport, Transporter } from 'nodemailer';
import { User } from '../users/schemas/user.schema';
import { escapeHtml, mailTemplate } from './mail-template';
import { join } from 'node:path';

export interface EventInvitation {
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
    if (!transport || !participantIds.length) return;
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
                  `<p>Hola ${escapeHtml(recipient.name)}, has sido incluido en un evento.</p><p style="color:#e8b954;font-family:Georgia,serif;font-size:26px">${escapeHtml(event.name)}</p><table role="presentation" width="100%" style="border:1px solid #6e542c;text-align:left"><tr><td style="padding:20px">Inicio: ${escapeHtml(dates.format(event.startDate))}<br><br>Fin: ${escapeHtml(dates.format(event.endDate))}<br><br>Horario: Europe/Madrid</td></tr></table><p>Prepárate, reúne tu criterio y afila el voto…</p><p style="color:#e8b954;font-weight:bold">A GUARREARLO TODO.</p>`,
                  this.frontendUrl
                    ? `${this.frontendUrl.split('#')[0]}#/events`
                    : undefined,
                ),
                text: [
                  `Hola ${recipient.name},`,
                  '',
                  `Has sido incluido en el evento «${event.name}».`,
                  '',
                  `Inicio: ${dates.format(event.startDate)}`,
                  `Fin: ${dates.format(event.endDate)}`,
                  'Horario: Europe/Madrid.',
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
