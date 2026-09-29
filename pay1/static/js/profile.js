function getToken() {
    return localStorage.getItem('accessToken') || localStorage.getItem('access_token');
}

document.addEventListener('DOMContentLoaded', () => {
    const token = getToken();
    if (!token) {
        window.location.href = '/login/';
        return;
    }

    const profileForm = document.querySelector('#profileForm');
    const passwordForm = document.querySelector('#passwordForm');
    const profileMessage = document.querySelector('#profileMessage');
    const passwordMessage = document.querySelector('#passwordMessage');

    loadProfile();

    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage(profileMessage, '');

        const submitButton = document.querySelector('#profileSubmit');
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';

        try {
            const formData = new FormData();
            formData.append('full_name', document.querySelector('#full_name').value.trim());
            formData.append('phone', document.querySelector('#phone').value.trim());
            const imageFile = document.querySelector('#profile_image').files[0];
            if (imageFile) {
                formData.append('profile_image', imageFile);
            }

            const response = await fetch('/api/profile/', {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${getToken()}` },
                body: formData,
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(formatErrors(data) || 'Unable to update your profile.');
            }

            applyProfile(data);
            setMessage(profileMessage, 'Profile updated successfully.', false);
        } catch (error) {
            setMessage(profileMessage, error.message, true);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Save changes';
        }
    });

    passwordForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setMessage(passwordMessage, '');

        const submitButton = document.querySelector('#passwordSubmit');
        submitButton.disabled = true;
        submitButton.textContent = 'Updating...';

        try {
            const response = await fetch('/api/profile/change-password/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getToken()}`,
                },
                body: JSON.stringify({
                    current_password: document.querySelector('#current_password').value,
                    new_password: document.querySelector('#new_password').value,
                }),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(formatErrors(data) || 'Unable to update your password.');
            }

            setMessage(passwordMessage, data.success || 'Password updated successfully.', false);
            passwordForm.reset();
        } catch (error) {
            setMessage(passwordMessage, error.message, true);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Update password';
        }
    });

    async function loadProfile() {
        try {
            const response = await fetch('/api/profile/', {
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            if (response.status === 401) {
                window.location.href = '/login/';
                return;
            }
            if (!response.ok) throw new Error('Could not load profile.');
            applyProfile(await response.json());
        } catch (error) {
            setMessage(profileMessage, 'Unable to load your profile right now.', true);
        }
    }

    function applyProfile(user) {
        document.querySelector('#full_name').value = user.full_name || '';
        document.querySelector('#email').value = user.email || '';
        document.querySelector('#phone').value = user.phone || '';
        document.querySelector('#profileNameLabel').textContent = user.full_name || 'Traveler';
        document.querySelector('#profileEmailLabel').textContent = user.email || '';

        const fallback = document.querySelector('#avatarFallback');
        const preview = document.querySelector('#avatarPreview');
        const initials = (user.full_name || user.email || '?').trim().charAt(0).toUpperCase();

        if (user.profile_image && !user.profile_image.includes('default.jpg')) {
            preview.src = user.profile_image;
            preview.classList.remove('hidden');
            fallback.classList.add('hidden');
        } else {
            fallback.textContent = initials;
            fallback.classList.remove('hidden');
            preview.classList.add('hidden');
        }
    }

    function setMessage(element, text, isError = false) {
        element.textContent = text;
        element.classList.toggle('hidden', !text);
        element.classList.toggle('text-red-600', Boolean(text) && isError);
        element.classList.toggle('text-emerald-600', Boolean(text) && !isError);
    }

    function formatErrors(errors) {
        if (!errors) return '';
        if (typeof errors.detail === 'string') return errors.detail;
        return Object.entries(errors)
            .map(([field, values]) => `${field}: ${Array.isArray(values) ? values.join(', ') : values}`)
            .join(' | ');
    }
});
