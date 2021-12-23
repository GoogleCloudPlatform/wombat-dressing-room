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

import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import DeleteForever from '@mui/icons-material/DeleteForever';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import { useTokens, TokenType } from './tokens-provider.tsx';
import Nav from './nav.tsx';

export default function ManageTokens() {
  const [initialLoad, setInitialLoad] = React.useState<boolean>(true);
  const [deleting, setDeleting] = React.useState<boolean>(false);
  const tokens = useTokens();

  React.useEffect(() => {
    if (!initialLoad) return;
    setInitialLoad(false);

    async function getTokens() {
      const resp = await fetch('/_/api/v1/tokens');
      const json = await resp.json();
      if (json.data) {
        const newTokens: Array<TokenType> = json.data.map((data) => {
          return {
            created: data.created,
            prefix: data.prefix,
            package: data.package ?? null,
            expiration: data.expiration ? data.expiration : null,
            releaseBacked: !!data['release-backed']
          }
        });
        tokens.set(newTokens);
      }
    }
    getTokens();
  }, [initialLoad, tokens]);

  return (
    <main>
      <CssBaseline />
      <Nav />
      <Container maxWidth="md">
        <h2>Manage Tokens</h2>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
            <TableHead>
              <TableRow>
                <TableCell>prefix</TableCell>
                <TableCell>package</TableCell>
                <TableCell>created</TableCell>
                <TableCell>expires</TableCell>
                <TableCell>release-backed</TableCell>
                <TableCell>actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tokens.tokens.map((row) => (
                <TableRow
                  key={`${row.prefix}-${row.created}`}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell component="th" scope="row">{row.prefix}</TableCell>
                  <TableCell>{row.package ? row.package : 'all packages'}</TableCell>
                  <TableCell>{(new Date(row.created)).toISOString()}</TableCell>
                  <TableCell>{row.expiration ? (new Date(row.expiration)).toISOString() : 'never'}</TableCell>
                  <TableCell>{row.releaseBacked ? 'true' : 'false'}</TableCell>
                  <TableCell>
                    <Button variant="outlined" startIcon={<DeleteForever />} disabled={deleting} onClick={async () => {
                      setDeleting(true);
                      await tokens.remove(row.prefix, row.created);
                      setDeleting(false);
                    }}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
    </main>
  );
}
