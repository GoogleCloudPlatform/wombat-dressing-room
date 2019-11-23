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

// userland types bug. this is the only documented way to clear the session.
const clearSession = req => {
  if (req) req.session = null;
};
module.exports.clearSession = clearSession;

//userland type doesnt include user.url
const ghUserData = user => {
  if (user)
    return {
      avatar_url: user.avatar_url,
      html_url: user.html_url,
      name: user.name,
      login: user.login,
    };
  return {};
};

module.exports.ghUserData = ghUserData;

//debug helper
const logEmit = emitter => {
  const oem = emitter.emit;
  emitter.emit = function(ev) {
    console.log(ev);
    return oem.apply(this, arguments);
  };
};
module.exports.logEmit = logEmit;
