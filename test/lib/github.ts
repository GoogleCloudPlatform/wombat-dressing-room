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
  describe('getLatestRelease', () => {
    it('returns latest release from GitHub', async () => {
      const request = nock('https://api.github.com')
        .get('/repos/bcoe/test/tags?per_page=100&page=1')
        .reply(200, [{name: 'v1.0.2'}]);

      const latest = await github.getRelease('bcoe/test', 'abc123', 'v1.0.2');
      expect(latest).to.equal('v1.0.2');
      request.done();
    });

    it('bubbles error appropriately', async () => {
      const request = nock('https://api.github.com')
        .get('/repos/bcoe/test/tags?per_page=100&page=1')
        .reply(404);
      let err: Error | undefined = undefined;
      try {
        await github.getRelease('bcoe/test', 'abc123', 'v1.0.2');
      } catch (_err) {
        err = _err;
      }
      expect(err).to.not.equal(undefined);
      if (err) {
        expect(err.message).to.include('unexpected http code');
      }
      request.done();
    });

    it('does not return latest release without prefix, when prefix used', async () => {
      const request = nock('https://api.github.com')
        .get('/repos/bcoe/test/tags?per_page=100&page=1')
        .reply(200, [{name: 'v1.0.2'}])
        .get('/repos/bcoe/test/tags?per_page=100&page=2')
        .reply(200, [{name: 'v1.0.3'}])
        .get('/repos/bcoe/test/tags?per_page=100&page=3')
        .reply(200, [{name: 'v1.0.4'}])
        .get('/repos/bcoe/test/tags?per_page=100&page=4')
        .reply(200, [{name: 'v1.0.5'}])
        .get('/repos/bcoe/test/tags?per_page=100&page=5')
        .reply(200, [{name: 'v1.0.6'}]);

      expect(
        await github.getRelease('bcoe/test', 'abc123', 'v1.0.2', 'foo')
      ).to.equal(undefined);
      request.done();
    });

    it('returns latest release matching prefix', async () => {
      const request = nock('https://api.github.com')
        .get('/repos/bcoe/test/tags?per_page=100&page=1')
        .reply(200, [{name: 'v1.0.3'}])
        .get('/repos/bcoe/test/tags?per_page=100&page=2')
        .reply(200, [{name: 'v1.0.4'}])
        .get('/repos/bcoe/test/tags?per_page=100&page=3')
        .reply(200, [{name: 'foo-v1.0.2'}]);

      const latest = await github.getRelease(
        'bcoe/test',
        'abc123',
        'v1.0.2',
        'foo'
      );
      expect(latest).to.equal('v1.0.2');
      request.done();
    });
  });
});
