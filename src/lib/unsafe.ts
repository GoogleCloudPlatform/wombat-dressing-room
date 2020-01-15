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

import {EventEmitter} from 'events';
import {GhUser} from './github';

// userland types bug. this is the only documented way to clear the session.
export const clearSession = (req: Express.Request) => {
  if (req) {
    // tslint:disable-next-line no-any
    (req.session as any) = null;
  }
};

//userland type doesnt include user.url
export const ghUserData = (user: GhUser) => {
  if (user) {
    return {
      avatar_url: user.avatar_url,
      html_url: user.html_url,
      name: user.name,
      login: user.login,
    };
  }
  return {};
};

//debug helper
export const logEmit = (emitter: EventEmitter) => {
  const oem = emitter.emit;
  emitter.emit = function(ev: string, ...args: Array<{}>) {
    console.log(ev);
    return oem.apply(this, [ev, ...args]);
  };
};
