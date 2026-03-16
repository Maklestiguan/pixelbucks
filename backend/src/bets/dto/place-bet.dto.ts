import { Dto, StringField, NumberField } from '../../validations';

@Dto({ strict: 'remove' })
export class PlaceBetDto {
  @StringField()
  eventId: string;

  @StringField()
  selection: string; // "a" | "b"

  @NumberField({ positive: true, integer: true })
  amount: number; // cents
}
