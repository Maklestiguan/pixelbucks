import { Dto, NumberField, StringField } from '../../validations';

@Dto({ strict: 'remove' })
export class UpdateEventDto {
  @NumberField({ optional: true, min: 1.1, max: 10.0 })
  oddsA?: number;

  @NumberField({ optional: true, min: 1.1, max: 10.0 })
  oddsB?: number;

  @NumberField({ optional: true, positive: true, integer: true })
  maxBet?: number;

  @StringField({ optional: true })
  status?: string;

  @NumberField({ optional: true, integer: true, min: 0, max: 120 })
  bettingOpenMinutes?: number;

  @NumberField({ optional: true, integer: true, positive: true })
  hltvId?: number;
}
