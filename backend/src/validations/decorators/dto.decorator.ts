import { setCompiled, updateSchema, registerClassDto } from '../helpers/';

export interface IDtoValidationOptions {
  strict?: boolean | 'remove';
  isResponseError?: boolean;
  example?: any;
  description?: string;
  title?: string;
}

export const Dto = (options?: IDtoValidationOptions): ClassDecorator => {
  return (target) => {
    const strict = options?.strict || false;
    registerClassDto(target, options);
    updateSchema(target.prototype, '$$strict', strict);
    setCompiled(target);
    return target;
  };
};
