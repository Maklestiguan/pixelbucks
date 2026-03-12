import { getInnerSchema, updateSchema } from './metadata.helper';

export const decoratorFactory = (mandatory = {}, defaults = {}) => {
  return function (options: any | any[] = {}): any {
    return (target: any, key: string | symbol): any => {
      updateSchema(target, key, { ...defaults, ...options, ...mandatory });
    };
  };
};

export const decoratorFactoryArray = (mandatory = {}, defaults = {}) => {
  return function (options: any | any[] = {}): any {
    if (typeof options.items == 'function') {
      options.items = {
        type: 'object',
        props: getInnerSchema(options.items),
      };
    }
    return (target: any, key: string | symbol): any => {
      updateSchema(target, key, {
        ...defaults,
        ...options,
        ...mandatory,
      });
    };
  };
};
