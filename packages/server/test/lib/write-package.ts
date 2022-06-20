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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    status: (_code: number) => {
      return;
    },
    end: () => {},
    json: () => {},
  } as Response;
}

describe('writePackage', () => {
  it('responds with 401 if publication key not found in datastore', async () => {
    writePackage.datastore = Object.assign({}, datastore, {
      getPublishKey: async (): Promise<PublishKey | false> => {
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
      getPublishKey: async (): Promise<PublishKey | false> => {
        return {
          username: 'bcoe',
          created: 1578630249529,
          value: 'deadbeef',
          releaseAs2FA: true,
        };
      },
      getUser: async (): Promise<false | User> => {
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
        getPublishKey: async (): Promise<PublishKey | false> => {
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
          };
        },
        getUser: async (): Promise<false | User> => {
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
        .get('/repos/foo/bar/tags?per_page=100&page=1')
        .reply(200, [{name: 'v1.0.0'}]);

      const ret = await writePackage('@soldair/foo', req, res);
      npmRequest.done();
      githubRequest.done();
      expect(ret.newPackage).to.equal(true);
      expect(ret.statusCode).to.equal(200);
    });

    it('allows a package to be updated', async () => {
      // Fake that there's a releaseAs2FA key in datastore:
      writePackage.datastore = Object.assign({}, datastore, {
        getPublishKey: async (): Promise<PublishKey | false> => {
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
          };
        },
        getUser: async (): Promise<false | User> => {
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
        .get('/repos/foo/bar/tags?per_page=100&page=1')
        .reply(200, [{name: 'v1.0.0'}]);

      const ret = await writePackage('@soldair/foo', req, res);
      npmRequest.done();
      githubRequest.done();
      expect(ret.newPackage).to.equal(false);
      expect(ret.statusCode).to.equal(200);
    });

    it('supports publication to next tag', async () => {
      // Fake that there's a releaseAs2FA key in datastore:
      writePackage.datastore = Object.assign({}, datastore, {
        getPublishKey: async (): Promise<PublishKey | false> => {
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
          };
        },
        getUser: async (): Promise<false | User> => {
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
        .get('/repos/foo/bar/tags?per_page=100&page=1')
        .reply(200, [{name: 'v1.0.0'}]);

      const ret = await writePackage('@soldair/foo', req, res);
      npmRequest.done();
      githubRequest.done();
      expect(ret.newPackage).to.equal(false);
      expect(ret.statusCode).to.equal(200);
    });

    it("does not allow PUTs that aren't publications, e.g., dist-tag updates", async () => {
      // Fake that there's a releaseAs2FA key in datastore:
      writePackage.datastore = Object.assign({}, datastore, {
        getPublishKey: async (): Promise<PublishKey | false> => {
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
          };
        },
        getUser: async (): Promise<false | User> => {
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
        getPublishKey: async (): Promise<PublishKey | false> => {
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
          };
        },
        getUser: async (): Promise<false | User> => {
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
        .get('/repos/foo/bar/tags?per_page=100&page=1')
        .reply(200, [{name: 'v0.1.0'}])
        .get('/repos/foo/bar/tags?per_page=100&page=2')
        .reply(200, [{name: 'v0.1.0'}])
        .get('/repos/foo/bar/tags?per_page=100&page=3')
        .reply(200, [{name: 'v0.1.0'}])
        .get('/repos/foo/bar/tags?per_page=100&page=4')
        .reply(200, [{name: 'v0.1.0'}])
        .get('/repos/foo/bar/tags?per_page=100&page=5')
        .reply(200, [{name: 'v0.1.0'}])
        .get('/repos/foo/bar/tags?per_page=100&page=6')
        .reply(200, [{name: 'v0.1.0'}])
        .get('/repos/foo/bar/tags?per_page=100&page=7')
        .reply(200, [{name: 'v0.1.0'}])
        .get('/repos/foo/bar/tags?per_page=100&page=8')
        .reply(200, [{name: 'v0.1.0'}])
        .get('/repos/foo/bar/tags?per_page=100&page=9')
        .reply(200, [{name: 'v0.1.0'}])
        .get('/repos/foo/bar/tags?per_page=100&page=10')
        .reply(200, [{name: 'v0.1.0'}])
        .get('/repos/foo/bar/tags?per_page=100&page=11')
        .reply(200, [{name: 'v0.1.0'}]);

      const ret = await writePackage('@soldair/foo', req, res);
      npmRequest.done();
      githubRequest.done();
      expect(ret.error).to.match(/matching release v1.0.0 not found/);
      expect(ret.statusCode).to.equal(400);
    });

    it('rejects publication if listing tags rerturns non-200', async () => {
      // Fake that there's a releaseAs2FA key in datastore:
      writePackage.datastore = Object.assign({}, datastore, {
        getPublishKey: async (): Promise<PublishKey | false> => {
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
          };
        },
        getUser: async (): Promise<false | User> => {
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
        .get('/repos/foo/bar/tags?per_page=100&page=1')
        .reply(500);

      const ret = await writePackage('@soldair/foo', req, res);
      npmRequest.done();
      githubRequest.done();
      expect(ret.error).to.match(/unknown error/);
      expect(ret.statusCode).to.equal(500);
    });

    it('allows package with monorepo token to be updated', async () => {
      // Fake that there's a releaseAs2FA key in datastore:
      writePackage.datastore = Object.assign({}, datastore, {
        getPublishKey: async (): Promise<PublishKey | false> => {
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
            monorepo: true,
          };
        },
        getUser: async (): Promise<false | User> => {
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
        .get('/repos/foo/bar/tags?per_page=100&page=1')
        .reply(200, [{name: 'foo-v1.0.0'}]);

      const ret = await writePackage('@soldair/foo', req, res);
      npmRequest.done();
      githubRequest.done();
      expect(ret.statusCode).to.equal(200);
      expect(ret.newPackage).to.equal(false);
    });

    it('allows package with monorepo token and lerna-style tags to be updated', async () => {
      // Fake that there's a releaseAs2FA key in datastore:
      writePackage.datastore = Object.assign({}, datastore, {
        getPublishKey: async (): Promise<PublishKey | false> => {
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
            monorepo: true,
          };
        },
        getUser: async (): Promise<false | User> => {
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
        .get('/repos/foo/bar/tags?per_page=100&page=1')
        .reply(200, [{name: '@soldair/foo@1.0.0'}]);

      const ret = await writePackage('@soldair/foo', req, res);
      npmRequest.done();
      githubRequest.done();
      expect(ret.statusCode).to.equal(200);
      expect(ret.newPackage).to.equal(false);
    });

    it('does not allow package with monorepo token to be updated if tag does not have prefix', async () => {
      // Fake that there's a releaseAs2FA key in datastore:
      writePackage.datastore = Object.assign({}, datastore, {
        getPublishKey: async (): Promise<PublishKey | false> => {
          return {
            username: 'bcoe',
            created: 1578630249529,
            value: 'deadbeef',
            releaseAs2FA: true,
            monorepo: true,
          };
        },
        getUser: async (): Promise<false | User> => {
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
        // This is monorepo-style token but the tags on GH are not monorepo-style
        .get('/repos/foo/bar/tags?per_page=100&page=1')
        .reply(200, [{name: 'v1.0.0'}])
        .get('/repos/foo/bar/tags?per_page=100&page=2')
        .reply(200, [{name: 'v1.0.3'}])
        .get('/repos/foo/bar/tags?per_page=100&page=3')
        .reply(200, [{name: 'v1.0.4'}])
        .get('/repos/foo/bar/tags?per_page=100&page=4')
        .reply(200, [{name: 'v1.0.5'}])
        .get('/repos/foo/bar/tags?per_page=100&page=5')
        .reply(200, [{name: 'v1.0.6'}])
        .get('/repos/foo/bar/tags?per_page=100&page=6')
        .reply(200, [{name: 'v1.0.7'}])
        .get('/repos/foo/bar/tags?per_page=100&page=7')
        .reply(200, [{name: 'v1.0.8'}])
        .get('/repos/foo/bar/tags?per_page=100&page=8')
        .reply(200, [{name: 'v1.0.9'}])
        .get('/repos/foo/bar/tags?per_page=100&page=9')
        .reply(200, [{name: 'v1.0.10'}])
        .get('/repos/foo/bar/tags?per_page=100&page=10')
        .reply(200, [{name: 'v1.0.10'}])
        .get('/repos/foo/bar/tags?per_page=100&page=11')
        .reply(200, [{name: 'v1.0.10'}]);

      const ret = await writePackage('@soldair/foo', req, res);
      npmRequest.done();
      githubRequest.done();
      expect(ret.error).to.match(/matching release v1.0.0 not found/);
      expect(ret.statusCode).to.equal(400);
    });
  });
});
