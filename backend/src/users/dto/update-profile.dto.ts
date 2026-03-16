import { Dto, BooleanField } from '../../validations';

@Dto({ strict: 'remove' })
export class UpdateProfileDto {
  @BooleanField({ optional: true })
  statsPublic?: boolean;
}
