import {
  decoratorFactory,
  registerProperty,
  EPropertyTypes,
} from '..//helpers';

import { ArrayField, IBaseFieldArrayOptions } from './array-field.decorator';

export interface INumberFieldOptions
  extends
    IBaseFieldArrayOptions,
    INumberFieldValidationOptions,
    Omit<INumberFieldSwaggerOptions, 'required'> {}

interface INumberFieldValidationOptions {
  positive?: boolean;
  negative?: boolean;
  integer?: boolean;
  min?: number;
  max?: number;
  optional?: boolean;
  convert?: boolean;
  nullable?: boolean;
}

interface INumberFieldSwaggerOptions {
  description?: string;
  example?: string;
  required?: boolean;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  multipleOf?: number;
  format?: 'float' | 'double' | 'int32' | 'int64';
  default?: number;
  nullable?: boolean;
}

const getNumberFieldValidationOptions = (
  options?: INumberFieldOptions,
): INumberFieldValidationOptions => {
  const result: INumberFieldValidationOptions = {};
  if (options?.integer !== undefined) result.integer = options.integer;
  if (options?.max !== undefined) result.max = options.max;
  if (options?.min !== undefined) result.min = options.min;
  if (options?.negative !== undefined) result.negative = options.negative;
  if (options?.positive !== undefined) result.positive = options.positive;
  if (options?.optional !== undefined) result.optional = options.optional;
  if (options?.nullable !== undefined) result.nullable = options?.nullable;
  if (options?.convert !== undefined) result.convert = options.convert;
  else result.convert = true;

  return result;
};
const getNumberFieldSwaggerOptions = (
  options?: INumberFieldOptions,
): INumberFieldSwaggerOptions => {
  const result: INumberFieldSwaggerOptions = {};
  if (options?.description) result.description = options.description;
  if (options?.example) result.example = options.example;
  if (options?.max !== undefined) result.maximum = options.max;
  if (options?.min !== undefined) result.minimum = options.min;
  if (options?.multipleOf !== undefined) result.multipleOf = options.multipleOf;
  if (options?.integer !== undefined) result.format = 'int32';
  if (options?.default !== undefined) result.default = options?.default;
  if (options?.nullable !== undefined) result.nullable = options?.nullable;

  if (options?.exclusiveMinimum !== undefined)
    result.exclusiveMinimum = options.exclusiveMinimum;
  if (options?.exclusiveMaximum !== undefined)
    result.exclusiveMaximum = options.exclusiveMaximum;

  if (options?.optional === true) result.required = false;
  else result.required = true;

  return result;
};

export const NumberField =
  (options?: INumberFieldOptions): PropertyDecorator =>
  (target: any, key: string | symbol): any => {
    const type = 'number';
    if (options?.isArray) {
      ArrayField(
        type,
        options.arrayOptions,
        getNumberFieldValidationOptions(options),
      )(target, key);
    } else {
      registerProperty(target, key, getNumberFieldSwaggerOptions(options), {
        type: EPropertyTypes.number,
      });
      decoratorFactory({ type })(getNumberFieldValidationOptions(options))(
        target,
        key,
      );
    }
  };
