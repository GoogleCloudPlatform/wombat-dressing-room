import {expect} from 'chai';
import {createPackument} from '../helpers/create-packument';

import {newVersions} from '../../src/lib/new-versions';

describe('newVersions', () => {
  it('returns versions added to packument "a" since packument "b"', () => {
    const versions = newVersions(
      createPackument('a')
        .addVersion('1.0.0')
        .packument(),
      createPackument('a')
        .addVersion('1.0.0')
        .addVersion('1.1.0')
        .packument()
    );
    expect(versions).to.eql(['1.1.0']);
  });

  it('returns an empty list if no new versions have been added', () => {
    const versions = newVersions(
      createPackument('a')
        .addVersion('1.0.0')
        .packument(),
      createPackument('a')
        .addVersion('1.0.0')
        .packument()
    );
    expect(versions).to.eql([]);
  });
});
