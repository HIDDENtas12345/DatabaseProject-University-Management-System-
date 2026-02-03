document.addEventListener('DOMContentLoaded', () => {
  const registerForm = document.getElementById('registerForm');
  const resultBox = document.getElementById('registerResult');

  registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    // Gather form data
    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch('/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      let resultData;
      try {
        resultData = await response.json();
      } catch (e) {
        resultBox.innerText = 'Registration failed. Invalid server response.';
        resultBox.style.color = 'red';
        return;
      }

      if (!response.ok) {
        resultBox.innerText = resultData.message || 'Registration failed.';
        resultBox.style.color = 'red';
        return;
      }

      resultBox.innerText = resultData.message || 'Registration successful.';
      resultBox.style.color = 'green';
      registerForm.reset();
      // Optionally redirect to login after success
      // setTimeout(() => { window.location.href = '/login.html'; }, 1500);

    } catch (err) {
      console.error('Signup error:', err);
      resultBox.innerText = '❌ Something went wrong. Please try again.';
      resultBox.style.color = 'red';
    }
  });
});
