import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UpdateProfileDto } from '../auth/dto/update-profile.dto';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';

import { registerDto } from '../auth/dto/register.dto';
import { User, UserDocument } from './schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly notifications: NotificationsService,
  ) {}

  async create(registerDto: registerDto) {
    const { name, email, password } = registerDto;

    const existingUser = await this.userModel.findOne({ email }).exec();

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = new this.userModel({
      name,
      email,
      passwordHash,
      isActive: false,
    });

    return user.save();
  }

  async findOrCreateGoogleUser(identity: {
    googleId: string;
    email: string;
    name: string;
    authoritativeEmail: boolean;
  }): Promise<UserDocument> {
    const linked = await this.userModel
      .findOne({ googleId: identity.googleId })
      .exec();
    if (linked) return linked;
    const existing = await this.userModel
      .findOne({ email: identity.email })
      .exec();
    if (existing) {
      if (existing.googleId || !identity.authoritativeEmail) {
        throw new UnauthorizedException(
          'Inicia sesión con tu contraseña para esta cuenta.',
        );
      }
      const linkedUser = await this.userModel
        .findOneAndUpdate(
          { _id: existing._id, googleId: { $exists: false } },
          { $set: { googleId: identity.googleId } },
          { new: true, runValidators: true },
        )
        .exec();
      if (!linkedUser)
        throw new ConflictException('Google account already linked');
      return linkedUser;
    }
    try {
      return await this.userModel.create({
        name: identity.name,
        email: identity.email,
        googleId: identity.googleId,
        isActive: false,
      });
    } catch (error: unknown) {
      if ((error as { code?: number }).code === 11000) {
        const concurrent = await this.userModel
          .findOne({ googleId: identity.googleId })
          .exec();
        if (concurrent) return concurrent;
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async findAll() {
    const users = await this.userModel
      .find()
      .select('_id name email role isActive')
      .sort({ name: 1 })
      .exec();
    return users.map((user) => ({
      id: user._id.toHexString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    }));
  }
  async findSummariesByIds(ids: Types.ObjectId[]) {
    const users = await this.userModel
      .find({ _id: { $in: ids } })
      .select('_id name')
      .sort({ name: 1 })
      .exec();
    return users.map((user) => ({
      id: user._id.toHexString(),
      name: user.name,
    }));
  }
  async findByEmailWithPassword(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .exec();
  }
  async findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  async updateActivation(id: string, isActive: boolean) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException('User not found');
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { $set: { isActive } },
        { new: false, runValidators: true },
      )
      .exec();
    if (!user) throw new NotFoundException('User not found');
    if (isActive && !user.isActive) {
      await this.notifications.accountActivated(user);
    }
    return {
      id: user._id.toHexString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isActive,
    };
  }

  async hasPassword(id: string) {
    return Boolean(
      await this.userModel.exists({
        _id: id,
        passwordHash: { $type: 'string', $ne: '' },
      }),
    );
  }

  async acknowledgePasswordPrompt(id: string) {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { $set: { passwordPromptSeen: true } },
        { new: true },
      )
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async createPassword(id: string, password: string) {
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new ConflictException('Password exceeds 72 bytes');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.userModel
      .findOneAndUpdate(
        {
          _id: id,
          isActive: true,
          googleId: { $type: 'string' },
          $or: [
            { passwordHash: { $exists: false } },
            { passwordHash: null },
            { passwordHash: '' },
          ],
        },
        { $set: { passwordHash, passwordPromptSeen: true } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!user)
      throw new ConflictException('Cannot create a password for this account');
    return user;
  }

  async updateProfile(id: string, profile: UpdateProfileDto) {
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            name: profile.name,
            ...(profile.avatar !== undefined ? { avatar: profile.avatar } : {}),
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
