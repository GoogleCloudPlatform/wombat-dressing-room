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
import CssBaseline from '@mui/material/CssBaseline';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import { styled } from '@mui/material/styles';

import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/cjs/styles/hljs';

import Nav from './nav.tsx';

const pkgJson = `{
  "repository": {
    "type": "git",
    "url": "https://github.com/my-repo/my-repo.git"
  }
}
`

const Item = styled(Paper)(({ theme }) => ({
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

export default function Help() {
  return (
    <main>
      <CssBaseline />
      <Nav disabled={false} />
      <Container maxWidth="md">
        <h2>Getting started</h2>
        <Box sx={{ flexGrow: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Item>
                <div style={{textAlign: 'left'}}>
                  <p>
                   Wombat Dressing Room is a service for publishing GitHub-hosted
                   packages to npm conveniently and securely. It uses the security context
                   of the source code repository instead of requiring users to manage
                   npm accounts, teams, 2FA tokens, and package permissions on the npm website.
                  </p>
                  <p>
                    If you have write access to a project on GitHub, you can publish the package to npm.
                  </p>
                  <p>
                    Your day to day use of npm remains the same, except when running commands that
                    write to the registry (publishing, unpublishing, updating tags).
                  </p>
                  <h3>Publishing to npm</h3>
                  <h4>Login to Wombat Dressing Room</h4>
                  <SyntaxHighlighter language="bash" style={docco}>
                    npm login --registry https://[my-wombat-deployment].appspot.com
                  </SyntaxHighlighter>
                  <p>
                    This will have you select either a <Link href="#temporary-token">temporary token</Link>
                    , a  <Link href="#release-backed">release-backed token</Link>,
                    or a <Link href="#package-scoped">package scoped token</Link>
                  </p>
                  <h4>Publish your package</h4>
                  <SyntaxHighlighter language="bash" style={docco}>
                    npm publish --registry https://[my-wombat-deployment].appspot.com
                  </SyntaxHighlighter>

                  <h3>Token types</h3>
                  <h4 id="temporary-token">Temporary</h4>
                  <p>
                    Temporary tokens can be used to publish to any package you have write permission to on
                    GitHub, but are only valid for 24 hours.
                  </p>
                  <h4 id="release-backed">Release backed</h4>
                  <p>
                   Release backed tokens can be used to publish to any package you have write permission to
                   on GitHub, but a corresponding release must also exist on GitHub. Release tags should be
                   of the form <b>v1.2.3</b>.
                  </p>
                  <Card sx={{ minWidth: 275 }}>
                    <CardContent>
                      <b>Note:</b> Choose <b>Support monorepo style tags</b> if you wish to release
                      multiple release backed packages from the same repository. If selected, tags should
                      be of the format <b>library-v1.2.3</b>.
                    </CardContent>
                  </Card>
                  <h4 id="package-scoped">Package scoped</h4>
                  <p>
                    Package scoped tokens can be used to publish to a single package on npm.
                  </p>
                  <h3>Preparing package for publication</h3>
                  In order to publish a package to npm with Wombat Dressing Room, the package
                  must have the <b>registry</b> field set in its <b>package.json</b>. This field
                  must be set to a repository you have write permission to, e.g,.
                  <SyntaxHighlighter language="json" style={docco}>
                    {pkgJson}
                  </SyntaxHighlighter>
                </div>
              </Item>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </main>
  );
}
