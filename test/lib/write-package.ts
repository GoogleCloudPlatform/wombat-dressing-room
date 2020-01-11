import {expect} from 'chai';
import {Request, Response} from 'express';
import * as nock from 'nock';

import {createPackument} from '../helpers/create-packument';
import {writePackageRequest} from '../helpers/write-package-request';

import * as datastore from '../../src/lib/datastore';
import {PublishKey, User} from '../../src/lib/datastore';
import {writePackage, WriteResponse} from '../../src/lib/write-package';

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

  it('responds with 400 if packument has no repository field', async () => {
    // Fake that there's a releaseAs2FA key in datastore:
    writePackage.datastore = Object.assign({}, datastore, {
      getPublishKey: async (username: string): Promise<PublishKey | false> => {
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

    // Simulate a publication request to the proxy:
    const req = writePackageRequest(
      {authorization: 'token: abc123'},
      createPackument('@soldair/foo')
        .addVersion('1.0.0')
        .packument()
    );
    const res = {status: (code: number) => {}, end: () => {}} as Response;

    // A 404 while fetching the packument indicates that the package
    // has not yet been created:
    const npmRequest = nock('https://registry.npmjs.org')
      .get('/@soldair%2ffoo')
      .reply(404);

    const ret = await writePackage('@soldair/foo', req, res);
    expect(ret.error).to.match(/must have a repository/);
    expect(ret.statusCode).to.equal(400);
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

      // Simulate a publication request to the proxy:
      const req = writePackageRequest(
        {authorization: 'token: abc123'},
        createPackument('@soldair/foo')
          .addVersion('1.0.0', 'https://github.com/foo/bar')
          .packument()
      );
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
