import { Type } from '@nestjs/common';

import {
  decoratorFactoryArray,
  registerProperty,
  EPropertyTypes,
  getSchema,
  EStringFormats,
} from '../helpers/';

export interface IBaseFieldArrayOptions {
  isArray?: boolean;
  arrayOptions?: IArrayFieldOptions;
}

export interface IArrayFieldOptions
  extends
    IArrayFieldValidationOptions,
    Omit<IArrayFieldSwaggerOptions, 'required'> {}

interface IArrayFieldValidationOptions {
  convert?: boolean;
  min?: number;
  max?: number;
  optional?: boolean;
  nullable?: boolean;
}

interface IArrayFieldSwaggerOptions {
  description?: string;
  example?: string;
  required?: boolean;
  default?: string;
  nullable?: boolean;
}

export const getArrayFieldValidationOptions = (
  options?: IArrayFieldOptions,
): IArrayFieldValidationOptions => {
  const result: IArrayFieldValidationOptions = {};
  if (options?.max !== undefined) result.max = options.max;
  if (options?.min !== undefined) result.min = options.min;
  if (options?.optional !== undefined) result.optional = options.optional;
  if (options?.nullable !== undefined) result.nullable = options?.nullable;
  if (options?.convert !== undefined) result.convert = options.convert;
  else result.convert = true;

  return result;
};
export const getArrayFieldSwaggerOptions = (
  options?: IArrayFieldOptions,
): IArrayFieldSwaggerOptions => {
  const result: IArrayFieldSwaggerOptions = {};
  if (options?.description) result.description = options.description;
  if (options?.example) result.example = options.example;
  if (options?.optional === true) result.required = false;
  else result.required = true;
  if (options?.default !== undefined) result.default = options?.default;
  if (options?.nullable !== undefined) result.nullable = options?.nullable;

  return result;
};

export const ArrayField =
  (
    type: Type<unknown> | string | object,
    options?: IArrayFieldOptions,
    typeOptions: any = {},
    stringFormat?: EStringFormats,
  ): PropertyDecorator =>
  (target, key) => {
    if (typeof type === 'function') {
      const props = Object.assign({}, getSchema(type));
      const strict = props.$$strict;
      delete props.$$strict;
      decoratorFactoryArray({
        type: 'array',
        items: {
          props,
          strict,
          type: 'object',
        },
      })(getArrayFieldValidationOptions(options))(target, key);

      registerProperty(target, key, getArrayFieldSwaggerOptions(options), {
        type: EPropertyTypes.array,
        target: type,
      });
    } else {
      if (typeof type === 'string') {
        registerProperty(target, key, getArrayFieldSwaggerOptions(options), {
          type: EPropertyTypes.array,
          items: {
            type: <EPropertyTypes>type,
            format: stringFormat,
          },
        });
      }

      decoratorFactoryArray({
        type: 'array',
        items: {
          type,
          ...typeOptions,
        },
      })(getArrayFieldValidationOptions(options))(target, key);
    }
  };
