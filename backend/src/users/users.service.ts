import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';

import { registerDto } from '../auth/dto/register.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
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
    });

    return user.save();
  }

  async findAll() {
    const users = await this.userModel
      .find()
      .select('_id name')
      .sort({ name: 1 })
      .exec();
    return users.map((user) => ({
      id: user._id.toHexString(),
      name: user.name,
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
}
