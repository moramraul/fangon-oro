import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
} from 'class-validator';
export class CreateVoteDto {
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @ArrayUnique((id: string) => (typeof id === 'string' ? id.toLowerCase() : id))
  @IsMongoId({ each: true })
  candidateIds!: string[];
}
