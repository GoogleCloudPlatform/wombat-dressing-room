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

import * as React from "react";

import { useAccount } from './account-provider.tsx';
import { useFlashMessage } from './flash-message-provider.tsx';

export interface TokenType {
  created: number;
  prefix: string;
  package: string;
  expiration: number;
  releaseBacked: boolean;
}

interface TokensType {
  tokens: Array<TokenType>; 
  create: (type: string) => Promise<void>;
  set: (token: TokenType) => {};
  remove: (prefix: string, created: number) => Promise<void>;
}

const TokensContext = React.createContext<TokensType>(null!);

interface CreateOpts {
  monorepo?: boolean;
};

export function TokensProvider({ children }: { children: React.ReactNode }) {
  const [tokens, setTokens] =  React.useState<any>([]);
  const account = useAccount();
  const flash = useFlashMessage();

  const set = (newTokens: Array<TokenType>) => {
    setTokens([...newTokens]);
  }

  const create = async (type: string, opts: CreateOpts = {}) => {
    const body: {type: string; ott?: string} = {
      ...opts,
      type,
    };
    if (account.ott) {
      body.ott = account.ott;
    }
    const req = await fetch('/_/token', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (req.status === 200) {
      const tokenObject = await req.json();
      flash.set('success', tokenObject.message);
      account.setOtt(undefined);
    }
    // TODO: add error handling with tests.
  }

  const remove = async (prefix: string, created: number) => {
    const newTokens = [];
    for (const token of tokens) {
      if (token.prefix === prefix && token.created === created) {
        await fetch('/_/api/v1/token', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(token)
        });
        // TODO: add error handling with tests.
        continue;
      } else {
        newTokens.push(token);
      }
    }
    setTokens([...newTokens]);
  };

  const value = { tokens, set, create, remove };

  return <TokensContext.Provider value={value}>{children}</TokensContext.Provider>;
}

export function useTokens() {
  return React.useContext(TokensContext);
}
