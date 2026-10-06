import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { createTransport } from 'nodemailer';
import { User } from '../users/schemas/user.schema';
import { NotificationsService } from './notifications.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('NotificationsService', () => {
  const userId = new Types.ObjectId();
  const event = {
    _id: new Types.ObjectId(),
    name: 'Evento de prueba',
    startDate: new Date('2099-10-01T12:00:00Z'),
    endDate: new Date('2099-10-02T12:00:00Z'),
  };
  const users = { find: jest.fn() };
  const sendMail = jest.fn<
    Promise<unknown>,
    [{ text: string; cc?: unknown; bcc?: unknown }]
  >();
  const settings = {
    MAIL_ENABLED: 'true',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'test',
    SMTP_PASSWORD: 'test-password',
    MAIL_FROM: 'Eventos <events@example.com>',
    FRONTEND_URL: 'https://app.example.com',
  };
  const service = (overrides: Record<string, string | undefined> = {}) =>
    new NotificationsService(
      new ConfigService({ ...settings, ...overrides }),
      users as unknown as Model<User>,
    );

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(createTransport)
      .mockReturnValue({ sendMail } as unknown as ReturnType<
        typeof createTransport
      >);
    sendMail.mockResolvedValue({});
    users.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([
            { _id: userId, name: 'Ana', email: 'ana@example.com' },
          ]),
      }),
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('sends activation confirmation with escaped content and a login link', async () => {
    await service().accountActivated({
      name: '<Ana>',
      email: 'ana@example.com',
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: { name: '<Ana>', address: 'ana@example.com' },
        subject: 'Tu cuenta ya está activa · Fangón de Oro',
        html: expect.stringContaining('Hola &lt;Ana&gt;,'),
        text: expect.stringContaining('https://app.example.com#/login'),
      }),
    );
  });

  it('does not send activation mail when disabled', async () => {
    await service({ MAIL_ENABLED: 'false' }).accountActivated({
      name: 'Ana',
      email: 'ana@example.com',
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('does not propagate SMTP failures during activation', async () => {
    sendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    await expect(
      service().accountActivated({ name: 'Ana', email: 'ana@example.com' }),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith('Account activation email failed');
  });

  it('uses configurable SMTP without connecting during construction', () => {
    service();
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: settings.SMTP_HOST,
        port: 587,
        secure: false,
        auth: { user: settings.SMTP_USER, pass: settings.SMTP_PASSWORD },
      }),
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('does not send or query recipients when disabled', async () => {
    await service({ MAIL_ENABLED: 'false' }).eventIncluded(event, [userId]);
    expect(createTransport).not.toHaveBeenCalled();
    expect(users.find).not.toHaveBeenCalled();
  });

  it('does not send for empty additions', async () => {
    await service().eventIncluded(event, []);
    expect(users.find).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends a private message containing the event, dates and app link', async () => {
    await service().eventIncluded(event, [userId]);
    expect(users.find).toHaveBeenCalledWith({ _id: { $in: [userId] } });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: settings.MAIL_FROM,
        to: { name: 'Ana', address: 'ana@example.com' },
        subject: `Has sido incluido en el evento: ${event.name}`,
        text: expect.stringContaining(settings.FRONTEND_URL) as string,
      }),
    );
    const message = sendMail.mock.calls[0][0];
    expect(message.text).toContain(event.name);
    expect(message.text).toContain('Inicio:');
    expect(message.text).toContain('Fin:');
    expect(message.text).toContain('Europe/Madrid');
    expect(message.cc).toBeUndefined();
    expect(message.bcc).toBeUndefined();
  });

  it('continues sending to other recipients after a transport failure', async () => {
    const second = new Types.ObjectId();
    users.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          { _id: userId, name: 'Ana', email: 'ana@example.com' },
          { _id: second, name: 'Bea', email: 'bea@example.com' },
        ]),
      }),
    });
    sendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    await expect(
      service().eventIncluded(event, [userId, second]),
    ).resolves.toBeUndefined();
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('does not propagate recipient lookup failures', async () => {
    users.find.mockImplementation(() => {
      throw new Error('Database unavailable');
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    await expect(
      service().eventIncluded(event, [userId]),
    ).resolves.toBeUndefined();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it.each([
    { SMTP_HOST: undefined },
    { MAIL_FROM: undefined },
    { SMTP_PORT: 'invalid' },
    { SMTP_PORT: '0' },
    { SMTP_SECURE: 'invalid' },
    { SMTP_PASSWORD: undefined },
    { FRONTEND_URL: 'javascript:alert(1)' },
  ])('rejects incomplete or invalid enabled configuration %p', (overrides) => {
    expect(() => service(overrides)).toThrow();
  });
});
