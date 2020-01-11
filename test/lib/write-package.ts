import {expect} from 'chai';
import {Request, Response} from 'express';
import * as nock from 'nock';

import * as datastore from '../../src/lib/datastore';
import {PublishKey, User} from '../../src/lib/datastore';
import {writePackage, WriteResponse} from '../../src/lib/write-package';

import request = require('request');

nock.disableNetConnect();

// TODO: rather than silencing info level logging, let's consider moving to
// a logger like winston or bunyan, which is easier to turn off in tests.
console.info = () => {};

describe('writePackage', () => {
  it('responds with 401 if publication key not found in datastore', async () => {
    writePackage.datastore = Object.assign({}, datastore, {
      getPublishKey: async (username: string): Promise<PublishKey | false> => {
        return false;
      },
    });
    const req = {headers: {authorization: 'token: abc123'}} as Request;
    const res = {status: (code: number) => {}, end: () => {}} as Response;
    const ret = await writePackage('@soldair/foo', req, res);
    expect(ret.statusCode).to.equal(401);
    expect(ret.error).to.match(/publish key not found/);
  });

  describe('releaseAs2FA', () => {
    it('appropriately routes initial package publication', async () => {
      // Fake that there's a releaseAs2FA key in datastore:
      writePackage.datastore = Object.assign({}, datastore, {
        getPublishKey: async (
          username: string
        ): Promise<PublishKey | false> => {
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
          };
        },
        getUser: async (username: string): Promise<false | User> => {
          return {name: 'bcoe', token: 'deadbeef'};
        },
      });
      writePackage.pipeToNpm = (
        req: Request,
        res: Response,
        drainedBody: false | Buffer,
        newPackage: boolean
      ): Promise<WriteResponse> => {
        return Promise.resolve({statusCode: 200, newPackage});
      };

      // Simulate a package publication request:
      const req = {
        headers: {authorization: 'token: abc123'},
        on: (event: 'data' | 'end', listener: (buffer?: Buffer) => void) => {
          switch (event) {
            case 'data':
              listener(
                Buffer.from(
                  JSON.stringify({
                    versions: {
                      '1.0.0': {
                        version: '1.0.0',
                        repository: 'https://github.com/foo/bar',
                      },
                    },
                    'dist-tags': {latest: '1.0.0'},
                  })
                )
              );
              break;
            case 'end':
              listener();
              break;
            default:
              break;
          }
        },
      } as Request;
      const res = {status: (code: number) => {}, end: () => {}} as Response;

      // A 404 while fetching the packument indicates that the package
      // has not yet been created:
      const npmRequest = nock('https://registry.npmjs.org')
        .get('/@soldair%2ffoo')
        .reply(404);

      const githubRequest = nock('https://api.github.com')
        // user has push access to repo in package.json
        .get('/repos/foo/bar')
        .reply(200, {permissions: {push: true}})
        // most recent release tag on GitHub is v1.0.0
        .get('/repos/foo/bar/releases/latest')
        .reply(200, {tag_name: 'v1.0.0'});

      const ret = await writePackage('@soldair/foo', req, res);
      expect(ret.newPackage).to.equal(true);
      expect(ret.statusCode).to.equal(200);
    });
  });
});
