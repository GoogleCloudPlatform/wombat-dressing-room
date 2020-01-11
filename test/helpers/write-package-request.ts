import {Packument} from '@npm/types';
import {Request} from 'express';

export function writePackageRequest(
  headers: {[key: string]: string},
  packument?: Packument
): Request {
  return {
    headers,
    on: (event: 'data' | 'end', listener: (buffer?: Buffer) => void) => {
      switch (event) {
        case 'data':
          listener(Buffer.from(JSON.stringify(packument)));
          break;
        case 'end':
          listener();
          break;
        default:
          break;
      }
    },
  } as Request;
}
