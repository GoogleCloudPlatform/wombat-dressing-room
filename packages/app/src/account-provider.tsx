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

import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';

import { Navigate, useLocation } from "react-router-dom";
import { useFlashMessage } from './flash-message-provider.tsx';

interface AccountContextType {
  authenticated: false,
  registryHref?: string,
  login?: string,
  ott?: string;
  logout: () => Promise<void>;
}

const AccountContext = React.createContext<AccountContextType>(null!);
 
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] =  React.useState<any>(false);
  const [registryHref, setRegistryHref] =  React.useState<any>(null);
  const [login, setLogin] = React.useState<any>(null);
  const [loading, setLoading] = React.useState<any>(true);
  const [initialLoad, setInitialLoad] = React.useState<boolean>(true);
  const [ott, setOtt] = React.useState<any>(undefined);
  const flash = useFlashMessage();

  const logout = async () => {
    await fetch('/logout', {
      method: 'POST'
    });
    setLogin(null);
    setAuthenticated(false);
    setRegistryHref(null);
    setOtt(false);
  };

  const value = { authenticated, registryHref, login, ott, setOtt, logout };

  React.useEffect(() => {
    if (!initialLoad) return;
    setInitialLoad(false);

    // Store ott used during authentication:
    let tempOtt;
    if (window.location.search) {
      const match = window.location.search.match(/ott=(?<ott>[^&]+)/);
      if (match && match.groups) {
        tempOtt = match.groups.ott;
      }
    }

    // Check if user is logged in, if so allow protected routes
    // to be accessed:
    async function fetchAccount() {
      const resp = await fetch(tempOtt ? `/_/account?ott=${tempOtt}` : '/_/account');
      const json = await resp.json();
      if (json.authenticated) {
        setLogin(json.login);
        setAuthenticated(json.authenticated);
        setRegistryHref(json.registryHref);
      }
      if (json.ott) {
        setOtt(json.ott);
      }
      if (json.flash) {
        const flashObject = JSON.parse(json.flash);
        flash.set(flashObject.severity, flashObject.message);   
      }
      setLoading(false);
    }

    fetchAccount();
  }, [flash, initialLoad]);

  if (!loading) {
    return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
  } else {
    return (
      <Backdrop
        sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={true}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    );
  }
}

export function useAccount() {
  return React.useContext(AccountContext);
}
 
export function RequireAccount({ children }: { children: JSX.Element }) {
  const account = useAccount();
  const location = useLocation();

  if (!account.authenticated) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/_/login" state={{ from: location }} />;
  }

  return children;
}
