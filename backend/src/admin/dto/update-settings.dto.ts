import { Dto, BooleanField } from '../../validations';

@Dto({ strict: 'remove' })
export class UpdateSettingsDto {
  @BooleanField({ optional: true })
  cs2AllowBetsWithoutHltv?: boolean;
}
