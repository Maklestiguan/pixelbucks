import { Dto, StringField } from '../../validations';

@Dto({ strict: 'remove' })
export class CreateFeedbackDto {
  @StringField({ min: 1, max: 500 })
  text: string;
}
