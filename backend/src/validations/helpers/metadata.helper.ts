import 'reflect-metadata';
import FastestValidator from 'fastest-validator';

import { CHECKER_FUNCTION, SCHEMA_KEY } from '../constants';
import { BuildSchemaError } from '../errors';

export function getSchema(target: any): any {
  return Reflect.getMetadata(SCHEMA_KEY, target.prototype);
}

export function getInnerSchema(target: any): any {
  const schema = Reflect.getMetadata(SCHEMA_KEY, target.prototype);
  delete schema['$$strict'];
  return schema;
}

export function setCompiled(target: any): void {
  const v = new FastestValidator({
    useNewCustomCheckerFunction: true,
  });
  const s = Reflect.getMetadata(SCHEMA_KEY, target.prototype) || {};
  Reflect.defineMetadata(CHECKER_FUNCTION, v.compile(s), target.prototype);
}

export function getCompiled(
  target: any,
): ReturnType<FastestValidator['compile']> {
  const compiled = Reflect.getMetadata(CHECKER_FUNCTION, target.prototype);
  if (!compiled) {
    throw new BuildSchemaError({ className: target.name });
  }
  return compiled;
}

export const updateSchema = (
  target: any,
  key: string | symbol,
  options: any,
): void => {
  const ownSchema = Reflect.getOwnMetadata(SCHEMA_KEY, target) || {};
  const extendsSchema = Reflect.getMetadata(SCHEMA_KEY, target) || {};
  ownSchema[key] = options;

  Object.assign(ownSchema, extendsSchema);

  Reflect.defineMetadata(SCHEMA_KEY, ownSchema, target);
};
