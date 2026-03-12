/* eslint-disable @typescript-eslint/ban-ts-comment */
import 'reflect-metadata';
import {
  OPENAPI_META_KEY_PROPERTY,
  OPENAPI_META_KEY_CLASS,
  OPENAPI_META_TARGET,
  CHECKER_FUNCTION,
} from '../constants';

export enum EPropertyTypes {
  string = 'string',
  number = 'number',
  integer = 'integer',
  boolean = 'boolean',
  array = 'array',
  object = 'object',
}

export enum EStringFormats {
  date = 'date',
  dateTime = 'date-time',
  password = 'password',
  byte = 'byte',
  binary = 'binary',
  uuid = 'uuid',
}

export type PropertyExtendedOptions = {
  type: EPropertyTypes;
  enum?: string[];
  items?: PropertyExtendedOptions;
  format?: EStringFormats;
  target?: any;
};

export type PropertyStoreEntity = {
  name: string;
  target: any;
  required: boolean;
  type: EPropertyTypes;
  options: any;
};

export type PropertyClassEntity = {
  name: string;
  properties: PropertyStoreEntity[];
};

export const registerProperty = (
  target: any,
  key,
  schema: any,
  extended: PropertyExtendedOptions,
): void => {
  const required = schema.required;
  delete schema.required;

  const dto: PropertyStoreEntity = {
    name: key,
    target: target,
    required: required,
    type: extended.type,
    options: Object.assign({}, schema, extended),
  };

  const store =
    (Reflect.getMetadata(OPENAPI_META_KEY_PROPERTY, OPENAPI_META_TARGET) as Map<
      string,
      PropertyClassEntity
    >) || new Map<string, PropertyClassEntity>();

  const entity =
    store.get(target.constructor.name) ||
    ({ name: target.constructor.name, properties: [] } as PropertyClassEntity);
  entity.properties.push(dto);
  store.set(target.constructor.name, entity);

  Reflect.defineMetadata(OPENAPI_META_KEY_PROPERTY, store, OPENAPI_META_TARGET);
};

export const registerClassDto = (target: any, options: any): void => {
  const parent = Object.getPrototypeOf(target.prototype).constructor.name;
  const dto = {
    name: target.name,
    target: target,
    proto: target.prototype,
    options: options || {},
    parent: parent !== 'Object' ? parent : null,
  };

  const store =
    (Reflect.getMetadata(OPENAPI_META_KEY_CLASS, OPENAPI_META_TARGET) as Map<
      string,
      any
    >) || new Map<string, any>();

  if (!store.has(dto.name)) {
    store.set(dto.name, dto);
  }

  Reflect.defineMetadata(OPENAPI_META_KEY_CLASS, store, OPENAPI_META_TARGET);
};

// @TODO: add strict types
export const getOpenApiComponents = () => {
  const classes = Reflect.getMetadata(
    OPENAPI_META_KEY_CLASS,
    OPENAPI_META_TARGET,
  );
  const properties = Reflect.getMetadata(
    OPENAPI_META_KEY_PROPERTY,
    OPENAPI_META_TARGET,
  );

  classes.forEach((item) => {
    item.properties = properties.get(item.name)?.properties || [];

    if (item.parent) {
      if (!classes.has(item.parent)) {
        throw new Error(
          `Cant find Parent DTO ${item.name} extends ${item.parent}`,
        );
      }
      item.properties = [
        ...(properties.get(item.parent)?.properties || []),
        ...item.properties,
      ];
    }

    if (item.options && item.options.isResponseError) {
      try {
        const params = new item.target();
        item.options.example = JSON.parse(JSON.stringify(params));
      } catch (e) {
        // nothing do
      }

      item.isResponseError = true;
      delete item.options.isResponseError;
    }

    item.properties.forEach((prop) => {
      if (prop.options.target !== undefined) {
        const name = prop.options.target.name;
        delete prop.options.target;

        if (!classes.has(name)) {
          throw new Error(
            `Cant find Child DTO ${item.name}:prop.name => ${name}`,
          );
        }

        if (prop.options.type === EPropertyTypes.array) {
          prop.options['items'] = {
            $ref: `#/components/schemas/${name}`,
          };
        } else {
          prop.options['$ref'] = `#/components/schemas/${name}`;
        }
      }
    });

    const validator = Reflect.getMetadata(CHECKER_FUNCTION, item.proto);

    if (validator) {
      item.validator = validator;
    }

    // delete item.proto;
  });

  return classes;
};
