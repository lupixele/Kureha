import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';

const handler = createStartHandler(defaultStreamHandler);

export default {
  fetch(request: Request, ...args: any[]) {
    return handler(request, ...args);
  }
};