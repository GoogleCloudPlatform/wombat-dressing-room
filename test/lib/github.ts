import {expect} from 'chai';
import * as nock from 'nock';
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
    });

    it('bubbles error appropriately', async () => {
      const request = nock('https://api.github.com')
                          .get('/repos/bcoe/test/releases/latest')
                          .reply(404);
      let err: Error|undefined = undefined;
      try {
        await github.getLatestRelease('bcoe/test', 'abc123');
      } catch (_err) {
        err = _err;
      }
      expect(err).to.not.equal(undefined);
      if (err) {
        expect(err.message).to.include('Release info error');
      }
    });
  });
});