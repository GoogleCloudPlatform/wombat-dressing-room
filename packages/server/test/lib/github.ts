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
import * as nock from 'nock';
import {describe, it} from 'mocha';
import * as github from '../../src/lib/github';

nock.disableNetConnect();

describe('github', () => {
  describe('getRelease', () => {
    it('returns matching release from GitHub', async () => {
      const request = nock('https://api.github.com')
        .get('/repos/bcoe/test/releases/tags/v1.0.2')
        .reply(200, {name: 'v1.0.2'});

      const latest = await github.getRelease('bcoe/test', 'abc123', ['v1.0.2']);
      expect(latest).to.equal('v1.0.2');
      request.done();
    });

    it('returns release matching monorepo-style tag', async () => {
      const request = nock('https://api.github.com')
        .get('/repos/bcoe/test/releases/tags/test-v1.0.2')
        .reply(200, {name: 'test-v1.0.2'});

      const latest = await github.getRelease('bcoe/test', 'abc123', [
        'test-v1.0.2',
        '@bcoe/test@1.0.2',
      ]);
      expect(latest).to.equal('test-v1.0.2');
      request.done();
    });

    it('returns release matching lerna-style tag', async () => {
      const request = nock('https://api.github.com')
        .get('/repos/bcoe/test/releases/tags/test-v1.0.2')
        .replyWithError({statusCode: 404})
        .get('/repos/bcoe/test/releases/tags/@bcoe/test@1.0.2')
        .reply(200, {name: '@bcoe/test@1.0.2'});

      const latest = await github.getRelease('bcoe/test', 'abc123', [
        'test-v1.0.2',
        '@bcoe/test@1.0.2',
      ]);
      expect(latest).to.equal('@bcoe/test@1.0.2');
      request.done();
    });

    it('returns matching tag from GitHub if no release found', async () => {
      const request = nock('https://api.github.com')
        .get('/repos/bcoe/test/releases/tags/v1.0.2')
        .replyWithError({statusCode: 404})
        .get('/repos/bcoe/test/git/refs/tags/v1.0.2')
        .reply(200, {ref: 'refs/tags/v1.0.2'});

      const latest = await github.getRelease('bcoe/test', 'abc123', ['v1.0.2']);
      expect(latest).to.equal('v1.0.2');
      request.done();
    });

    it('checks tags if there is an error while checking releases', async () => {
      const request = nock('https://api.github.com')
        .get('/repos/bcoe/test/releases/tags/v1.0.2')
        .replyWithError({statusCode: 500})
        .get('/repos/bcoe/test/git/refs/tags/v1.0.2')
        .reply(200, {ref: 'refs/tags/v1.0.2'});

      const latest = await github.getRelease('bcoe/test', 'abc123', ['v1.0.2']);
      expect(latest).to.equal('v1.0.2');
      request.done();
    });

    it('bubbles error appropriately', async () => {
      const request = nock('https://api.github.com')
        .get('/repos/bcoe/test/releases/tags/v1.0.2')
        .replyWithError({statusCode: 404})
        .get('/repos/bcoe/test/git/refs/tags/v1.0.2')
        .reply(401);
      let err: Error | undefined = undefined;
      try {
        await github.getRelease('bcoe/test', 'abc123', ['v1.0.2']);
      } catch (_err) {
        err = _err as Error;
      }
      expect(err).to.not.equal(undefined);
      if (err) {
        expect(err.message).to.include('unexpected http code = 401');
      }
      request.done();
    });

    it('does not return latest tag without prefix, when monorepo-style used', async () => {
      const request = nock('https://api.github.com')
        .get('/repos/bcoe/test/releases/tags/foo-v1.0.2')
        .replyWithError({statusCode: 404})
        .get('/repos/bcoe/test/releases/tags/@scope/foo@1.0.2')
        .replyWithError({statusCode: 404})
        .get('/repos/bcoe/test/git/refs/tags/foo-v1.0.2')
        .replyWithError({statusCode: 404})
        .get('/repos/bcoe/test/git/refs/tags/@scope/foo@1.0.2')
        .replyWithError({statusCode: 404});

      expect(
        await github.getRelease('bcoe/test', 'abc123', [
          'foo-v1.0.2',
          '@scope/foo@1.0.2',
        ])
      ).to.equal(undefined);
      request.done();
    });

    it('returns latest tag matching monorepo style tag', async () => {
      const request = nock('https://api.github.com')
        .get('/repos/bcoe/test/releases/tags/foo-v1.0.2')
        .replyWithError({statusCode: 404})
        .get('/repos/bcoe/test/git/refs/tags/foo-v1.0.2')
        .reply(200, {ref: 'refs/tags/foo-v1.0.2'});

      const latest = await github.getRelease('bcoe/test', 'abc123', [
        'foo-v1.0.2',
      ]);
      expect(latest).to.equal('foo-v1.0.2');
      request.done();
    });

    it('returns latest tag matching lerna style tag', async () => {
      const request = nock('https://api.github.com')
        .get('/repos/bcoe/test/releases/tags/@scope/foo@1.0.2')
        .replyWithError({statusCode: 404})
        .get('/repos/bcoe/test/git/refs/tags/@scope/foo@1.0.2')
        .reply(200, {ref: 'refs/tags/@scope/foo@1.0.2'});

      const latest = await github.getRelease('bcoe/test', 'abc123', [
        '@scope/foo@1.0.2',
      ]);
      expect(latest).to.equal('@scope/foo@1.0.2');
      request.done();
    });
  });
});
