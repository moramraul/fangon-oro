import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async create(name: string, email: string) {
    const user = new this.userModel({
      name,
      email,
    });

    return user.save();
  }

  async findAll() {
    return this.userModel.find().exec();
  }
}
