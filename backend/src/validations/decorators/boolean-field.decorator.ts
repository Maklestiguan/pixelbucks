import { decoratorFactory, registerProperty, EPropertyTypes } from '../helpers';

import { ArrayField, IBaseFieldArrayOptions } from './array-field.decorator';

export interface IBooleanFieldOptions
  extends
    IBaseFieldArrayOptions,
    IBooleanFieldValidationOptions,
    Omit<IBooleanFieldSwaggerOptions, 'required'> {}

interface IBooleanFieldValidationOptions {
  optional?: boolean;
  convert?: boolean;
  nullable?: boolean;
}

interface IBooleanFieldSwaggerOptions {
  description?: string;
  example?: string;
  required?: boolean;
  nullable?: boolean;
}

const getBooleanFieldValidationOptions = (
  options?: IBooleanFieldOptions,
): IBooleanFieldValidationOptions => {
  const result: IBooleanFieldValidationOptions = {};
  if (options?.optional !== undefined) result.optional = options.optional;
  if (options?.nullable !== undefined) result.nullable = options?.nullable;
  if (options?.convert !== undefined) result.convert = options.convert;
  else result.convert = true;

  return result;
};
const getBooleanFieldSwaggerOptions = (
  options?: IBooleanFieldOptions,
): IBooleanFieldSwaggerOptions => {
  const result: IBooleanFieldSwaggerOptions = {};
  if (options?.description) result.description = options.description;
  if (options?.nullable !== undefined) result.nullable = options?.nullable;
  if (options?.example) result.example = options.example;
  if (options?.optional === true) result.required = false;
  else result.required = true;

  return result;
};

export const BooleanField =
  (options?: IBooleanFieldOptions): PropertyDecorator =>
  (target: any, key: string | symbol): any => {
    const type = 'boolean';
    if (options?.isArray) {
      ArrayField(
        type,
        options.arrayOptions,
        getBooleanFieldValidationOptions(options),
      )(target, key);
    } else {
      registerProperty(target, key, getBooleanFieldSwaggerOptions(options), {
        type: EPropertyTypes.boolean,
      });
      decoratorFactory({ type })(getBooleanFieldValidationOptions(options))(
        target,
        key,
      );
    }
  };
