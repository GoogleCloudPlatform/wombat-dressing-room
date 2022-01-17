/**
 * Copyright 2021 Google LLC
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

import { Routes, Route} from "react-router-dom";

import {AccountProvider, RequireAccount} from './account-provider.tsx';
import CreateToken from './create-token.tsx';
import {FlashMessageProvider} from './flash-message-provider.tsx';
import Help from './help.tsx';
import ManageTokens from './manage-tokens.tsx';
import {Login} from './login.tsx';
import {TokensProvider} from './tokens-provider.tsx';

export default function App() {
  return (
    <FlashMessageProvider>
      <AccountProvider>
        <TokensProvider>
          <Routes>
            <Route path="/" element={<RequireAccount><CreateToken /></RequireAccount>} />
            <Route path="/_/help" element={<Help />} />
            <Route path="/_/login" element={<Login />} />
            <Route path="/_/manage" element={<RequireAccount><ManageTokens /></RequireAccount>} />
          </Routes>
        </TokensProvider>
      </AccountProvider>
    </FlashMessageProvider>
  )
}
