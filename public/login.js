document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const formData = new FormData(this);
  const data = Object.fromEntries(formData.entries());

  // Clear previous messages
  const resultEl = document.getElementById('loginResult');
  resultEl.innerText = '';

  try {
    const res = await fetch('http://localhost:3001/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include' // important for session
    });

    if (!res.ok) {
      // If server returns 4xx or 5xx
      const errData = await res.json().catch(() => ({ message: 'Login failed' }));
      resultEl.innerText = errData.message || 'Login failed';
      return;
    }

    const result = await res.json();
    console.log('Login response:', result);

    // Save logged-in user for dashboard use
    if (result.user) {
      localStorage.setItem('loggedInUser', JSON.stringify(result.user));
    }

    // Redirect to correct dashboard
    if (result.redirect) {
      window.location.href = result.redirect;
    } else {
      resultEl.innerText = result.message || 'Login failed.';
    }

  } catch (err) {
    console.error('Login error:', err);
    resultEl.innerText = 'Error occurred during login. Check server.';
  }
});
