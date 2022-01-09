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
import { useNavigate} from "react-router-dom";

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import { styled } from '@mui/material/styles';

import Nav from './nav.tsx';
import { useAccount } from './account-provider.tsx';

const Item = styled(Paper)(({ theme }) => ({
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

export function Login() {
  const [initialLoad, setInitialLoad] = React.useState<boolean>(true);
  const [loginLink, setLoginLink] = React.useState<any>(null);
  const navigate = useNavigate();
  const account = useAccount();

  React.useEffect(() => {
    if (account.login) {
      navigate('/', { replace: true });
    } else if (initialLoad) {
      setInitialLoad(false);
      async function getLoginLink() {
        const resp = await fetch('/_/login-link');
        const json = await resp.json();
        setLoginLink(json.link);
      }
      getLoginLink();
    }
  }, [account, navigate, initialLoad]);

  return (
    <main>
      <CssBaseline />
      <Nav />
      <div style={{paddingTop: '10px'}} />
      <Container maxWidth="md">
        <Box sx={{ flexGrow: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Item>
                <div style={{textAlign: 'left'}}>
                  <ButtonGroup variant="contained" aria-label="outlined primary button group">
                    <Button href={loginLink}>Login to Wombat Dressing Room</Button>
                  </ButtonGroup>
                </div>
              </Item>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </main>
  );
}
