import * as express from 'express';

export const drainRequest = (req: express.Request): Promise<Buffer >=> {
  return new Promise((resolve, reject) => {
    const buf: Buffer[] = [];
    req.on('data', (b: Buffer) => {
      buf.push(b);
    });
    req.on('end', () => {
      resolve(Buffer.concat(buf));
    });
    req.on('error', (e) => {
      reject(e);
    });
  });
};
