import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsString, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";

@ValidatorConstraint({ name: 'NoDuplicates', async: false })
class NoDuplicatesConstraint implements ValidatorConstraintInterface {
  validate(fileNames: string[], _args: ValidationArguments) {
    const set = new Set(fileNames);
    return set.size === fileNames.length;
  }

  defaultMessage(_args: ValidationArguments) {
    return 'Duplicate file names are not allowed.';
  }
}

export class DeleteFilesDto {
    @IsArray()
    @ArrayMinSize(1, { message: 'At least one file must be provided.' })
    @ArrayMaxSize(10, { message: 'You can delete a maximum of 10 files at once.' })
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    // @Matches(/^(claims|profiles)[\w\-]+\.(jpg|jpeg|png|gif|webp)$/i, {
    //     each: true,
    //     message:
    //     'Each file must begin with "claims" or "profiles" and end with a valid image extension (.jpg, .jpeg, .png, .gif, .webp)',
    // })
    @Validate(NoDuplicatesConstraint)
    fileNames: string[]
}