import {
  decoratorFactory,
  registerProperty,
  EPropertyTypes,
  EStringFormats,
} from '../helpers/';

import { ArrayField, IBaseFieldArrayOptions } from './array-field.decorator';

export interface IDateFieldOptions
  extends
    IBaseFieldArrayOptions,
    IDateFieldValidationOptions,
    Omit<IDateFieldSwaggerOptions, 'required'> {}

interface IDateFieldValidationOptions {
  optional?: boolean;
  convert?: boolean;
  nullable?: boolean;
}

interface IDateFieldSwaggerOptions {
  description?: string;
  example?: string;
  required?: boolean;
  default?: string;
  nullable?: boolean;
}

const getDateFieldValidationOptions = (
  options?: IDateFieldOptions,
): IDateFieldValidationOptions => {
  const result: IDateFieldValidationOptions = {};
  if (options?.optional !== undefined) result.optional = options.optional;
  if (options?.nullable !== undefined) result.nullable = options?.nullable;
  if (options?.convert !== undefined) result.convert = options.convert;
  else result.convert = true;

  return result;
};
const getDateFieldSwaggerOptions = (
  options?: IDateFieldOptions,
): IDateFieldSwaggerOptions => {
  const result: IDateFieldSwaggerOptions = {};
  if (options?.description) result.description = options.description;
  if (options?.example) result.example = options.example;
  if (options?.optional === true) result.required = false;
  else result.required = true;
  if (options?.default !== undefined) result.default = options?.default;
  if (options?.nullable !== undefined) result.nullable = options?.nullable;

  return result;
};

export const DateField =
  (options?: IDateFieldOptions): PropertyDecorator =>
  (target: any, key: string | symbol): any => {
    const type = 'date';
    if (options?.isArray) {
      ArrayField(
        type,
        options.arrayOptions,
        getDateFieldValidationOptions(options),
      )(target, key);
    } else {
      registerProperty(target, key, getDateFieldSwaggerOptions(options), {
        type: EPropertyTypes.string,
        format: EStringFormats.dateTime,
      });
      decoratorFactory({ type })(getDateFieldValidationOptions(options))(
        target,
        key,
      );
    }
  };
