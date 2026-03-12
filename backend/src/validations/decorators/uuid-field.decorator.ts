import {
  decoratorFactory,
  registerProperty,
  EPropertyTypes,
  EStringFormats,
} from '../helpers';

import { ArrayField, IBaseFieldArrayOptions } from './array-field.decorator';

export interface IUuidFieldOptions
  extends
    IBaseFieldArrayOptions,
    IUuidFieldValidationOptions,
    Omit<IUuidFieldSwaggerOptions, 'required'> {}

interface IUuidFieldValidationOptions {
  optional?: boolean;
  convert?: boolean;
  nullable?: boolean;
}

interface IUuidFieldSwaggerOptions {
  description?: string;
  example?: string;
  required?: boolean;
  nullable?: boolean;
}

const getUuidFieldValidationOptions = (
  options?: IUuidFieldOptions,
): IUuidFieldValidationOptions => {
  const result: IUuidFieldValidationOptions = {};
  if (options?.optional !== undefined) result.optional = options.optional;
  if (options?.nullable !== undefined) result.nullable = options.nullable;
  if (options?.convert !== undefined) result.convert = options.convert;
  else result.convert = true;

  return result;
};
const getUuidFieldSwaggerOptions = (
  options?: IUuidFieldOptions,
): IUuidFieldSwaggerOptions => {
  const result: IUuidFieldSwaggerOptions = {};
  if (options?.description) result.description = options.description;
  if (options?.nullable !== undefined) result.nullable = options.nullable;
  if (options?.example) result.example = options.example;
  if (options?.nullable !== undefined) result.nullable = options?.nullable;
  if (options?.optional === true) result.required = false;
  else result.required = true;

  return result;
};

export const UuidField =
  (options?: IUuidFieldOptions): PropertyDecorator =>
  (target: any, key: string | symbol): any => {
    const type = 'uuid';
    if (options?.isArray) {
      ArrayField(
        EPropertyTypes.string,
        options.arrayOptions,
        getUuidFieldValidationOptions(options),
        EStringFormats.uuid,
      )(target, key);
    } else {
      registerProperty(target, key, getUuidFieldSwaggerOptions(options), {
        type: EPropertyTypes.string,
        format: EStringFormats.uuid,
      });
      decoratorFactory({ type })(getUuidFieldValidationOptions(options))(
        target,
        key,
      );
    }
  };
