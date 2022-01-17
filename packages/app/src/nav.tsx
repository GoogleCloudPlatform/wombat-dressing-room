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

import Alert from '@mui/material/Alert';
import AccountCircle from '@mui/icons-material/AccountCircle';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import HelpIcon from '@mui/icons-material/Help';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { useNavigate } from "react-router-dom";

import { useAccount } from './account-provider.tsx';
import { useFlashMessage } from './flash-message-provider.tsx';

export default function Nav() {
  const navigate = useNavigate();
  const account = useAccount();
  const flash = useFlashMessage();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleClose();
    await account.logout();
    flash.set('info', 'Logged out of Wombat Dressing Room');
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" color="primary">
        <Toolbar>
          <Tooltip title="Getting started" arrow>
            <IconButton
              data-testid="nav-help"
              size="large"
              aria-label="help"
              aria-controls="menu-appbar"
              color="inherit"
              onClick={() => {
                navigate('/_/help');
              }}
            >
              <HelpIcon />
            </IconButton>
          </Tooltip>
          <ButtonGroup disableElevation variant="text" sx={{ flexGrow: 1 }}>
            <Button onClick={() => {
              navigate('/');
            }} variant="text" color="inherit">Create Token</Button>
            <Button onClick={() => {
              navigate('/_/manage');
            }} variant="text" color="inherit">Manage Tokens</Button>
          </ButtonGroup>
          {account.login && (
            <Box>
              <Typography component="span" sx={{ flexGrow: 1 }}>
                {account.login}
              </Typography>
              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
              >
                <AccountCircle />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </Menu>
            </Box>
          )}
          {!account.login && (
            <Box>
              <Button variant="text" color="inherit" onClick={() => {
                navigate('/_/login');
              }}>Login</Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>
      {flash.message && (
        <Alert onClose={() => { flash.reset() }} variant="outlined" severity={flash.severity}>
          {flash.message}
        </Alert>
      )}
    </Box>
  );
}
