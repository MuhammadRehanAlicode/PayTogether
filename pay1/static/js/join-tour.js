document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('#joinTourForm');
    const input = document.querySelector('#joinCode');
    const message = document.querySelector('#joinMessage');
    const submitButton = document.querySelector('#joinSubmit');
    const token = localStorage.getItem('accessToken') || localStorage.getItem('access_token');

    if (!token) {
        window.location.href = '/login/';
        return;
    }

    input.addEventListener('input', () => {
        input.value = input.value.replace(/[^a-z0-9]/gi, '').toUpperCase();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const joinCode = input.value.trim().toUpperCase();
        showMessage('');

        if (!joinCode) {
            showMessage('Enter a join code.', true);
            input.focus();
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Joining...';
        try {
            const response = await fetch('/api/tours/join/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ join_code: joinCode }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const fieldError = data.join_code && data.join_code[0];
                throw new Error(fieldError || data.detail || 'Unable to join this tour.');
            }
            showMessage(data.detail || 'Tour joined successfully.');
            window.setTimeout(() => { window.location.href = '/dashboard/'; }, 700);
        } catch (error) {
            showMessage(error.message || 'Unable to join this tour.', true);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Join tour';
        }
    });

    function showMessage(text, isError = false) {
        message.textContent = text;
        message.classList.toggle('hidden', !text);
        message.classList.toggle('text-red-600', Boolean(text) && isError);
        message.classList.toggle('text-emerald-600', Boolean(text) && !isError);
    }
});
