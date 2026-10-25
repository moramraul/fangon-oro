import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
export class CreateVoteDto {
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @ArrayUnique((id: string) => (typeof id === 'string' ? id.toLowerCase() : id))
  @IsMongoId({ each: true })
  candidateIds!: string[];

  // Same order as candidateIds: 5, 3 and 1 points.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  justifications?: string[];
}
