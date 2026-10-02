import { IsMongoId } from 'class-validator';

export class CreateVoteDto {
  @IsMongoId()
  votedUserId!: string;
}
