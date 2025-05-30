import { createProxy as originalModuleProxy } from './node_modules/next/dist/build/webpack/loaders/next-flight-loader/module-proxy';

export const createProxy = (...args) => {
  return originalModuleProxy(...args);
};
