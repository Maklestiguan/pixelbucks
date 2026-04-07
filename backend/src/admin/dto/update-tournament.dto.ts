import { Dto, DateField, NumberField } from '../../validations';

@Dto({ strict: 'remove' })
export class UpdateTournamentDto {
  @NumberField({
    optional: true,
    integer: true,
    positive: true,
    nullable: true,
  })
  hltvEventId?: number | null;

  @DateField({ optional: true, nullable: true })
  endAt?: Date | null;
}
