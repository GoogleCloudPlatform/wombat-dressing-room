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

import * as React from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Checkbox from '@mui/material/Checkbox';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import { styled } from '@mui/material/styles';
import TextField from '@mui/material/TextField';

import Nav from './nav.tsx';
import { useTokens } from './tokens-provider.tsx';

const Item = styled(Paper)(({ theme }) => ({
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

export default function CreateToken() {
  const tokens = useTokens();
  const [state, setState] = React.useState({
    monorepo: false,
    packageName: '',
  })

  function handleChange(evt) {
    const checkboxes = ['monorepo'];
    const value = checkboxes.includes(evt.target.name) ? evt.target.checked : evt.target.value;
    setState({
      ...state,
      [evt.target.name]: value
    });
  }

  return (
    <main>
      <CssBaseline />
      <Nav />
      <Container maxWidth="md">
        <h2>Create token</h2>
        <p>Choose from one of the following token types:</p>
        <Box sx={{ flexGrow: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Item>
                <div style={{textAlign: 'left'}}>
                  <h3>24 hour temporary token</h3>
                  <p className="token-description">
                    If you are publishing from your workstation, or running the npm CLI
                    directly, this is likely the best option.
                  </p>
                  <ButtonGroup variant="contained" aria-label="outlined primary button group">
                    <Button data-testid="ttl" onClick={async () => {
                      await tokens.create('ttl');
                      window.scrollTo(0, 0)
                    }}>
                      Create Token
                    </Button>
                  </ButtonGroup>
                </div>
              </Item>
            </Grid>
            <Grid item xs={12}>
              <Item>
                <div style={{textAlign: 'left'}}>
                <h3>Release-backed token</h3>
                <p className="token-description">
                  A publication will only be permitted if a corresponding release is
                  found on GitHub.
                </p>
                <form onSubmit={async (event) => {
                  event.preventDefault();
                  await tokens.create('release', {
                    monorepo: state.monorepo
                  });
                  window.scrollTo(0, 0)
                }}>
                  <FormGroup>
                    <FormControlLabel control={<Checkbox name="monorepo" onChange={handleChange} />} label="Support monorepo style tags" />
                  </FormGroup>
                  <ButtonGroup variant="contained" aria-label="outlined primary button group">
                    <Button data-testid="release" type="submit">Create Token</Button>
                  </ButtonGroup>
                </form>
                </div>
              </Item>
            </Grid>
            <Grid item xs={12}>
              <Item>
                <div style={{textAlign: 'left'}}>
                <h3>Package specific publish token.</h3>
                  <p className="token-description">
                    Package tokens do not timeout, but can only publish a single package.
                    Use these for build automation, etc.
                  </p>
                  <form onSubmit={async (event) => {
                    event.preventDefault();
                    await tokens.create('package', {
                      packageName: state.packageName
                    });
                    window.scrollTo(0, 0)
                  }}>
                    <FormGroup>
                      <TextField
                        required
                        placeholder="@googleapis/leftpad"
                        name="packageName"
                        label="Package Name"
                        autoComplete='off'
                        helperText="Full name of packge token supports"
                        onChange={handleChange}
                      />
                    </FormGroup>
                    <ButtonGroup variant="contained" aria-label="outlined primary button group">
                      <Button data-testid="package" type="submit">Create Token</Button>
                    </ButtonGroup>
                  </form>
                </div>
              </Item>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </main>
  );
}
