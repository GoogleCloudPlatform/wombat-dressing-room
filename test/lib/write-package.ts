/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {expect} from 'chai';
import {Request, Response} from 'express';
import * as nock from 'nock';
import {describe, it} from 'mocha';

import {createPackument} from '../helpers/create-packument';
import {writePackageRequest} from '../helpers/write-package-request';

import * as datastore from '../../src/lib/datastore';
import {PublishKey, User} from '../../src/lib/datastore';
import {writePackage, WriteResponse} from '../../src/lib/write-package';

nock.disableNetConnect();

function mockResponse() {
  return {
    status: (code: number) => {
      code;
      return;
    },
    end: () => {},
    json: () => {},
  } as Response;
}

// TODO: rather than silencing info level logging, let's consider moving to
// a logger like winston or bunyan, which is easier to turn off in tests.
console.info = () => {};

describe('writePackage', () => {
  it('responds with 401 if publication key not found in datastore', async () => {
    writePackage.datastore = Object.assign({}, datastore, {
      getPublishKey: async (username: string): Promise<PublishKey | false> => {
        username;
        return false;
      },
    });
    const req = {headers: {authorization: 'token: abc123'}} as Request;
    const res = mockResponse();
    const ret = await writePackage('@soldair/foo', req, res);
    expect(ret.statusCode).to.equal(401);
    expect(ret.error).to.match(/publish key not found/);
  });

  it('responds with 400 if packument has no repository field', async () => {
    // Fake that there's a releaseAs2FA key in datastore:
    writePackage.datastore = Object.assign({}, datastore, {
      getPublishKey: async (username: string): Promise<PublishKey | false> => {
        username;
        return {
          username: 'bcoe',
          created: 1578630249529,
          value: 'deadbeef',
          releaseAs2FA: true,
        };
      },
      getUser: async (username: string): Promise<false | User> => {
        username;
        return {name: 'bcoe', token: 'deadbeef'};
      },
    });

    // Simulate a publication request to the proxy:
    const req = writePackageRequest(
      {authorization: 'token: abc123'},
      createPackument('@soldair/foo').addVersion('1.0.0').packument()
    );
    const res = mockResponse();

    // A 404 while fetching the packument indicates that the package
    // has not yet been created:
    const npmRequest = nock('https://registry.npmjs.org')
      .get('/@soldair%2ffoo')
      .reply(404);

    const ret = await writePackage('@soldair/foo', req, res);
    npmRequest.done();
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
          username;
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
          };
        },
        getUser: async (username: string): Promise<false | User> => {
          username;
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
      const res = mockResponse();

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
        .get('/repos/foo/bar/releases/tags/v1.0.0')
        .reply(200, {tag_name: 'v1.0.0'});

      const ret = await writePackage('@soldair/foo', req, res);
      npmRequest.done();
      githubRequest.done();
      expect(ret.newPackage).to.equal(true);
      expect(ret.statusCode).to.equal(200);
    });

    it('allows a package to be updated', async () => {
      // Fake that there's a releaseAs2FA key in datastore:
      writePackage.datastore = Object.assign({}, datastore, {
        getPublishKey: async (
          username: string
        ): Promise<PublishKey | false> => {
          username;
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
          };
        },
        getUser: async (username: string): Promise<false | User> => {
          username;
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
      const res = mockResponse();

      const npmRequest = nock('https://registry.npmjs.org')
        .get('/@soldair%2ffoo')
        .reply(
          200,
          createPackument('@soldair/foo')
            .addVersion('0.1.0', 'https://github.com/foo/bar')
            .packument()
        );

      const githubRequest = nock('https://api.github.com')
        // user has push access to repo in package.json
        .get('/repos/foo/bar')
        .reply(200, {permissions: {push: true}})
        // most recent release tag on GitHub is v1.0.0
        .get('/repos/foo/bar/releases/tags/v1.0.0')
        .reply(200, {tag_name: 'v1.0.0'});

      const ret = await writePackage('@soldair/foo', req, res);
      npmRequest.done();
      githubRequest.done();
      expect(ret.newPackage).to.equal(false);
      expect(ret.statusCode).to.equal(200);
    });

    it('supports publication to next tag', async () => {
      // Fake that there's a releaseAs2FA key in datastore:
      writePackage.datastore = Object.assign({}, datastore, {
        getPublishKey: async (
          username: string
        ): Promise<PublishKey | false> => {
          username;
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
          };
        },
        getUser: async (username: string): Promise<false | User> => {
          username;
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
        createPackument('@soldair/foo', 'next')
          .addVersion('1.0.0', 'https://github.com/foo/bar')
          .packument()
      );
      const res = mockResponse();

      const npmRequest = nock('https://registry.npmjs.org')
        .get('/@soldair%2ffoo')
        .reply(
          200,
          createPackument('@soldair/foo')
            .addVersion('0.1.0', 'https://github.com/foo/bar')
            .packument()
        );

      const githubRequest = nock('https://api.github.com')
        // user has push access to repo in package.json
        .get('/repos/foo/bar')
        .reply(200, {permissions: {push: true}})
        // most recent release tag on GitHub is v1.0.0
        .get('/repos/foo/bar/releases/tags/v1.0.0')
        .reply(200, {tag_name: 'v1.0.0'});

      const ret = await writePackage('@soldair/foo', req, res);
      npmRequest.done();
      githubRequest.done();
      expect(ret.newPackage).to.equal(false);
      expect(ret.statusCode).to.equal(200);
    });

    it("does not allow PUTs that aren't publications, e.g., dist-tag updates", async () => {
      // Fake that there's a releaseAs2FA key in datastore:
      writePackage.datastore = Object.assign({}, datastore, {
        getPublishKey: async (
          username: string
        ): Promise<PublishKey | false> => {
          username;
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
          };
        },
        getUser: async (username: string): Promise<false | User> => {
          username;
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

      // simulate a dist-tag update:
      const req = writePackageRequest(
        {authorization: 'token: abc123'},
        '0.2.3'
      );
      const res = mockResponse();

      // A 404 while fetching the packument indicates that the package
      // has not yet been created:
      const npmRequest = nock('https://registry.npmjs.org')
        .get('/@soldair%2ffoo')
        .reply(
          200,
          createPackument('@soldair/foo')
            .addVersion('1.0.0', 'https://github.com/foo/bar')
            .packument()
        );

      const githubRequest = nock('https://api.github.com')
        // user has push access to repo in package.json
        .get('/repos/foo/bar')
        .reply(200, {permissions: {push: true}});

      const ret = await writePackage('@soldair/foo', req, res);
      npmRequest.done();
      githubRequest.done();
      expect(ret.error).to.match(/used exclusively for publication/);
      expect(ret.statusCode).to.equal(400);
    });

    it('rejects publication if no corresponding release found on GitHub', async () => {
      // Fake that there's a releaseAs2FA key in datastore:
      writePackage.datastore = Object.assign({}, datastore, {
        getPublishKey: async (
          username: string
        ): Promise<PublishKey | false> => {
          username;
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
          };
        },
        getUser: async (username: string): Promise<false | User> => {
          username;
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
      const res = mockResponse();

      const npmRequest = nock('https://registry.npmjs.org')
        .get('/@soldair%2ffoo')
        .reply(
          200,
          createPackument('@soldair/foo')
            .addVersion('0.1.0', 'https://github.com/foo/bar')
            .packument()
        );

      const githubRequest = nock('https://api.github.com')
        // user has push access to repo in package.json
        .get('/repos/foo/bar')
        .reply(200, {permissions: {push: true}})
        // most recent release tag on GitHub is v0.1.0
        .get('/repos/foo/bar/releases/tags/v1.0.0')
        .reply(404);

      const ret = await writePackage('@soldair/foo', req, res);
      npmRequest.done();
      githubRequest.done();
      expect(ret.error).to.match(/matching release v1.0.0 not found/);
      expect(ret.statusCode).to.equal(400);
    });
  });
});
