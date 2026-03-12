import { Dto, StringField } from '../../validations';

@Dto({ strict: 'remove' })
export class RegisterDto {
  @StringField({ min: 3, max: 20 })
  username: string;

  @StringField({ min: 6, max: 100 })
  password: string;
}
