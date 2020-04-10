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
        .get('/repos/bcoe/test/releases/latest')
        .reply(200, {tag_name: 'v1.0.2'});
      const latest = await github.getLatestRelease('bcoe/test', 'abc123');
      expect(latest).to.equal('v1.0.2');
      request.done();
    });

    it('bubbles error appropriately', async () => {
      const request = nock('https://api.github.com')
        .get('/repos/bcoe/test/releases/latest')
        .reply(404);
      let err: Error | undefined = undefined;
      try {
        await github.getLatestRelease('bcoe/test', 'abc123');
      } catch (_err) {
        err = _err;
      }
      expect(err).to.not.equal(undefined);
      if (err) {
        expect(err.message).to.include('Release info error');
      }
      request.done();
    });
  });
});
