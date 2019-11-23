document.getElementById('logout-link').addEventListener('click', ev => {
  ev.preventDefault();
  logout();
});

async function logout() {
  response = await fetch('/logout', {method: 'POST'});
  window.location = '/';
}

// global api object.
const api = {
  tokens: async () => {
    const res = await fetch('/_/api/v1/tokens');
    const result = await res.json();
    return result;
  },
  tokenDelete: async data => {
    if (!data.prefix || !data.created) {
      throw new Error('key prefix and created required');
    }
    const res = await fetch('/_/api/v1/token', {
      method: 'DELETE',
      headers: {
        'Content-type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return await res.json();
  },
  tokenCreate: async package => {
    const res = await fetch('/_/api/v1/token', {
      method: 'PUT',
      headers: {
        'Content-type': 'application/json',
      },
      body: JSON.stringify({package}),
    });
    return await res.json();
  },
};
