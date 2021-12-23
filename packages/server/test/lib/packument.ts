import {expect} from 'chai';
import {describe, it} from 'mocha';

import {repoToGithub} from '../../src/lib/packument';

describe('repoToGithub', () => {
  it('handles github url shorthand with extra path segments', () => {
    const result = repoToGithub({
      type: 'git',
      url: 'GoogleCloudPlatform/cloud-for-marketing/tree/master/marketing-analytics/activation/common-libs/nodejs-common',
    });

    const match = repoToGithub({
      type: 'git',
      url: 'GoogleCloudPlatform/cloud-for-marketing',
    });

    const expected = {
      url: 'https://github.com/GoogleCloudPlatform/cloud-for-marketing',
      name: 'GoogleCloudPlatform/cloud-for-marketing',
    };

    expect(result).to.eql(expected);
    expect(match).to.eql(expected);
  });
});
