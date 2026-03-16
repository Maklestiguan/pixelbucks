import { ArrayField, IBaseFieldArrayOptions } from './array-field.decorator';
import { EPropertyTypes, registerProperty, decoratorFactory } from '../helpers';

export interface IStringFieldOptions
  extends
    IBaseFieldArrayOptions,
    IStringFieldValidationOptions,
    Omit<IStringFieldSwaggerOptions, 'required'> {}

interface IStringFieldValidationOptions {
  min?: number;
  max?: number;
  optional?: boolean;
  convert?: boolean;
  nullable?: boolean;
  numeric?: boolean;
}

interface IStringFieldSwaggerOptions {
  description?: string;
  example?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  format?: 'date' | 'date-time' | 'password' | 'byte' | 'binary';
  pattern?: string;
  default?: string;
  nullable?: boolean;
}

const getStringFieldValidationOptions = (
  options?: IStringFieldOptions,
): IStringFieldValidationOptions => {
  const result: IStringFieldValidationOptions = {};
  if (options?.max !== undefined) result.max = options.max;
  if (options?.min !== undefined) result.min = options.min;
  if (options?.optional !== undefined) result.optional = options.optional;
  if (options?.nullable !== undefined) result.nullable = options?.nullable;
  if (options?.convert !== undefined) result.convert = options.convert;
  if (options?.numeric !== undefined) result.numeric = options.numeric;
  else result.convert = true;

  return result;
};
const getStringFieldSwaggerOptions = (
  options?: IStringFieldOptions,
): IStringFieldSwaggerOptions => {
  const result: IStringFieldSwaggerOptions = {};
  if (options?.description) result.description = options.description;
  if (options?.example) result.example = options.example;
  if (options?.default !== undefined) result.default = options?.default;
  if (options?.nullable !== undefined) result.nullable = options?.nullable;
  if (options?.optional === true) result.required = false;
  else result.required = true;

  return result;
};

export const StringField =
  (options?: IStringFieldOptions): PropertyDecorator =>
  (target: any, key: string | symbol): any => {
    const type = 'string';
    if (options?.isArray) {
      ArrayField(
        type,
        options.arrayOptions,
        getStringFieldValidationOptions(options),
      )(target, key);
    } else {
      registerProperty(target, key, getStringFieldSwaggerOptions(options), {
        type: EPropertyTypes.string,
      });
      decoratorFactory({ type })(getStringFieldValidationOptions(options))(
        target,
        key,
      );
    }
  };
