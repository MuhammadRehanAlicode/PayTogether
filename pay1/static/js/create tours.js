document.addEventListener('DOMContentLoaded', () => {
	const form = document.querySelector('#tourForm');

	if (!form) {
		return;
	}

	const accessToken = localStorage.getItem('accessToken')
		|| localStorage.getItem('access_token');
	const submitButton = form.querySelector('button[type="submit"]');
	const imageInput = form.querySelector('#image');
	const message = document.createElement('p');
	const imageLabel = form.querySelector('label[for="image"] .text-sm');

	message.setAttribute('role', 'alert');
	message.className = 'hidden text-sm font-semibold';
	form.querySelector('#message').appendChild(message);

	if (!accessToken) {
		window.location.href = '/login/';
		return;
	}

	imageInput?.addEventListener('change', () => {
		const image = imageInput.files?.[0];

		if (image && !image.type.startsWith('image/')) {
			imageInput.value = '';
			showMessage('Please choose a valid image file.', true);
			return;
		}

		if (image && imageLabel) {
			imageLabel.textContent = image.name;
		}
	});

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		clearMessage();

		if (!form.reportValidity()) {
			return;
		}

		submitButton.disabled = true;
		submitButton.textContent = 'Creating...';

		try {
			const response = await fetch(form.action, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
				body: new FormData(form),
			});

			const data = await response.json().catch(() => ({}));

			if (!response.ok) {
				throw new Error(formatErrors(data));
			}

			showMessage('Tour created successfully.');
			form.reset();
			if (imageLabel) {
				imageLabel.textContent = 'Choose an image';
			}
		} catch (error) {
			showMessage(error.message || 'Unable to create the tour.', true);
		} finally {
			submitButton.disabled = false;
		submitButton.textContent = 'Save tour';
		}
	});

	function showMessage(text, isError = false) {
		message.textContent = text;
		message.classList.remove('hidden', 'text-teal-600', 'text-red-600');
		message.classList.add(isError ? 'text-red-600' : 'text-teal-600');
	}

	function clearMessage() {
		message.classList.add('hidden');
	}

	function formatErrors(errors) {
		if (typeof errors.detail === 'string') {
			return errors.detail;
		}

		return Object.entries(errors)
			.map(([field, values]) => `${field}: ${values.join(', ')}`)
			.join(' | ') || 'Unable to create the tour.';
	}
});
