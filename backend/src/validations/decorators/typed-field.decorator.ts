import { Type } from '@nestjs/common';
import {
  getSchema,
  updateSchema,
  registerProperty,
  EPropertyTypes,
} from '../helpers';
import { ArrayField, IBaseFieldArrayOptions } from './array-field.decorator';

export interface ITypedFieldOptions
  extends IBaseFieldArrayOptions, ITypedFieldValidationOptions {}

interface ITypedFieldValidationOptions {
  optional?: boolean;
  convert?: boolean;
}

export const TypedField = (
  type: Type<unknown>,
  options?: ITypedFieldOptions,
) => {
  return (target: any, key: string): any => {
    const props = Object.assign({}, getSchema(type));
    const strict = props.$$strict || false;
    delete props.$$strict;

    if (options?.isArray) {
      ArrayField(type, options.arrayOptions)(target, key);
    } else {
      registerProperty(target, key, getTypedFieldSwaggerOptions(options), {
        type: EPropertyTypes.object,
        target: type,
      });
      updateSchema(target, key, {
        ...getTypedFieldValidationOptions(options),
        props,
        strict,
        type: 'object',
      });
    }
  };
};

const getTypedFieldValidationOptions = (
  options?: ITypedFieldOptions,
): ITypedFieldValidationOptions => {
  const result: ITypedFieldValidationOptions = {};

  if (options?.optional !== undefined) result.optional = options.optional;
  if (options?.convert !== undefined) result.convert = options.convert;
  else result.convert = true;

  return result;
};
const getTypedFieldSwaggerOptions = (
  options?: ITypedFieldOptions,
): { required?: boolean } => {
  return options
    ? {
        required: options.optional === true ? false : true,
      }
    : {
        required: true,
      };
};
