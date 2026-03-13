import { Dto, NumberField, StringField } from '../../validations';

@Dto({ strict: 'remove' })
export class AdjustBalanceDto {
  @NumberField({ integer: true })
  amount: number; // signed cents: positive = credit, negative = debit

  @StringField({ optional: true, max: 200 })
  reason?: string;
}
