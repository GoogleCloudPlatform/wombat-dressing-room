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

const aDatastore = require('@google-cloud/datastore');
import * as uuid from 'uuid';
import {config} from './config';
const isUUID = require('is-uuid');

const FIVE_MINUTES = 1000 * 60 * 5;

export const generatePublishKey = () => {
  return uuid.v4();
};

const datastore = new aDatastore({projectId: config.projectId});

// save the user's github token to verify repo access on key based publish
export const createUser =
    (username: string, githubToken: string): Promise<{} >=> {
  if (!config.loginEnabled) {
    return Promise.reject(
        new Error('login/creation of new users is disabled on this server.'));
  }

  // The kind for the new entity
  const kind = 'User';
  // The Cloud Datastore key for the new entity
  const key = datastore.key([kind, username]);

  // Prepares the new entity
  const user = {
    key,
    data: {name: username, token: githubToken},
  };

  // Saves the entity
  return datastore.save(user);
};

export const getUser = async(username: string): Promise<false|User> => {
  const key = datastore.key(['User', username]);

  const res = await datastore.get(key);
  if (!res || !res[0]) {
    return false;
  }

  return res[0];
};

export const saveHandoffKey = async(publishKey: string): Promise<string> => {
  const handoff = uuid.v4() + '_h';

  const dbKey = datastore.key(['HandoffKey', handoff]);
  await datastore.save({
    key: dbKey,
    data: {value: publishKey, complete: false, created: Date.now()}
  });

  return handoff;
};

export const completeHandoffKey = async(handoff: string): Promise<string> => {
  if (!config.loginEnabled) {
    return Promise.reject(new Error('disabled on this server.'));
  }

  const obj = await getHandoffKey(handoff);
  if (!obj) {
    throw new Error('handoff expired');
  }
  obj.complete = true;

  const dbKey = datastore.key(['HandoffKey', handoff]);
  await datastore.update({key: dbKey, data: obj});

  return handoff;
};

export const getHandoffKey =
    async(handoff: string): Promise<HandoffKey|false> => {
  const dbKey = datastore.key(['HandoffKey', handoff]);
  const result = await datastore.get(dbKey);
  if (!result || !result.length || !result[0]) {
    throw new Error('missing handoff key');
  }

  const obj = result[0];
  if (Date.now() - obj.created <= FIVE_MINUTES) {
    return obj;
  }
  return false;
};

export const savePublishKey = async(
    username: string, publishKey: string, packageName?: string,
    expiration?: number, releaseAs2FA?: boolean): Promise<{}> => {
  if (!config.loginEnabled) {
    return Promise.reject(new Error('disabled on this server.'));
  }

  if (!isUUID.v4(publishKey)) {
    throw new Error('publish key must be a valid uuid. got ' + publishKey);
  }

  const dbKey = datastore.key(['PublishKey', publishKey]);
  return datastore.save({
    key: dbKey,
    data: {
      value: publishKey,
      username,
      created: Date.now(),
      package: packageName,
      expiration,
      releaseAs2FA
    }
  });
};

export type PublishKeyResult = [PublishKey[], {}];

export const getPublishKeys = (username: string): Promise<PublishKey[] >=> {
  console.log(username, ' querying tokens for <-----');
  const query = datastore.createQuery('PublishKey');
  query.filter('username', username);
  query.order('created');

  /*
  [ [ { username: 'soldair',
    value: '-------',
    created: 1542390424985,
    [Symbol(KEY)]: [Key] },
    { created: 1543342784972,
      username: 'soldair',
      value: '-------',
      [Symbol(KEY)]: [Key] },
    ],
    { moreResults: 'NO_MORE_RESULTS',
    endCursor:
    'abcfakecursor'
  } ]
  */
  return datastore.runQuery(query).then((result: PublishKeyResult) => {
    return (result[0] || []).filter((row) => {
      return (row.expiration || Infinity) >= Date.now();
    });
  });
};

export const getObfuscatedPublishKey =
    (username: string, created: number, prefix: string):
        Promise<PublishKey|undefined >=> {
  const query = datastore.createQuery('PublishKey');
  query.filter('username', username);
  // this is a load bearing typecast to number.
  query.filter('created', +created);

  return datastore.runQuery(query).then((result: PublishKeyResult) => {
    const rows = result[0];
    let found: PublishKey|undefined;
    console.log('found rows for obfuscated key ', rows.length);
    rows.forEach((row) => {
      // dont find anything if prefix is too short
      if (row.value.indexOf(prefix) === 0 && prefix.length >= 5) {
        found = row;
      }
    });
    return found;
  });
};


export const getPublishKey = async(id: string): Promise<PublishKey|false >=> {
  const dbKey = datastore.key(['PublishKey', id]);
  const res = await datastore.get(dbKey);
  console.log('has publish key for id? ', !!res);
  if (!res || !res.length) {
    return false;
  }
  return res[0];
};

export const deletePublishKeys = async (username: string) => {
  const query = datastore.createQuery('PublishKey');
  query.filter('username', username);
  query.order('created');

  const result = await datastore.runQuery(query);
  if (result && result[0].length) {
    const keys = [];
    for (let i = 0; i < result[0].length; ++i) {
      keys.push(result[0][i][datastore.KEY]);
    }
    await datastore.delete(keys);
  }
  return true;
};

export const deletePublishKey = async (token: string) => {
  const key = datastore.key(['PublishKey', token]);
  const deleteResult = await datastore.delete([key]);
  console.log(deleteResult);
  return true;
};


type User = {
  // tslint:disable-next-line:no-any
  [k: string]: any
}|UserMain;

export interface PublishKey {
  username: string;
  value: string;
  created: number;
  package?: string;
  expiration?: number;
  releaseAs2FA?: boolean;
}

interface UserMain {
  name: string;
  token: string;
}

interface HandoffKey {
  value: string;
  complete: boolean;
  created: number;
}
