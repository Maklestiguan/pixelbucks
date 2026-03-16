import {
  IBaseFieldArrayOptions,
  getArrayFieldValidationOptions,
} from './array-field.decorator';
import {
  EPropertyTypes,
  registerProperty,
  decoratorFactory,
} from '../helpers/';

export interface IEnumFieldOptions
  extends
    IBaseFieldArrayOptions,
    IEnumFieldValidationOptions,
    IEnumFieldSwaggerOptions {}

interface IEnumFieldValidationOptions {
  unique?: boolean;
  empty?: boolean;
  optional?: boolean;
  convert?: boolean;
  nullable?: boolean;
}
interface IEnumFieldSwaggerOptions {
  description?: string;
  example?: string;
  required?: boolean;
  default?: string;
  nullable?: boolean;
}

export const EnumField =
  (
    type: Record<string, string>,
    options?: IEnumFieldOptions,
  ): PropertyDecorator =>
  (target: object, key: string | symbol) => {
    if (options?.isArray) {
      registerProperty(
        target,
        key,
        getEnumFieldSwaggerOptions(options.arrayOptions),
        {
          type: EPropertyTypes.array,
          items: {
            type: EPropertyTypes.string,
            enum: Object.values(type),
          },
        },
      );
      decoratorFactory({
        type: 'array',
        items: 'string',
        enum: Object.values(type),
      })(getArrayFieldValidationOptions(options.arrayOptions))(target, key);
    } else {
      registerProperty(target, key, getEnumFieldSwaggerOptions(options), {
        type: EPropertyTypes.string,
        enum: Object.values(type),
      });
      decoratorFactory({
        type: 'string',
        enum: Object.values(type),
      })(getEnumFieldValidationOptions(options))(target, key);
    }
  };

const getEnumFieldValidationOptions = (
  options?: IEnumFieldOptions,
): IEnumFieldValidationOptions => {
  const result: IEnumFieldValidationOptions = {};
  if (options?.optional !== undefined) result.optional = options?.optional;
  if (options?.empty !== undefined) result.empty = options?.empty;
  if (options?.unique !== undefined) result.unique = options.unique;
  if (options?.nullable !== undefined) result.nullable = options?.nullable;
  if (options?.convert !== undefined) result.convert = options.convert;
  else result.convert = true;

  return result;
};
const getEnumFieldSwaggerOptions = (
  options?: IEnumFieldOptions,
): IEnumFieldSwaggerOptions => {
  const result: IEnumFieldSwaggerOptions = {};
  if (options?.description) result.description = options.description;
  if (options?.example) result.example = options.example;
  if (options?.default !== undefined) result.default = options?.default;
  if (options?.nullable !== undefined) result.nullable = options?.nullable;
  if (options?.optional === true) result.required = false;
  else result.required = true;

  return result;
};
