function getaccessToken() {
    return localStorage.getItem('accessToken') || localStorage.getItem('access_token');
}

function getRefreshToken() {
    return localStorage.getItem('refreshToken') || localStorage.getItem('refresh_token');
}

function isAuthenticated() {
    return getaccessToken() !== null && getRefreshToken() !== null;
}

function clearTokens() {
    ['accessToken', 'refreshToken', 'access_token', 'refresh_token']
        .forEach((key) => localStorage.removeItem(key));
}

document.addEventListener('DOMContentLoaded', () => {

    if (!isAuthenticated()) {
        window.location.href = '/login/';
        return;
    }

    const logoutButtons = document.querySelectorAll('[data-action="logout"]');
    logoutButtons.forEach((logoutButton) => {
        logoutButton.addEventListener('click', async () => {
            logoutButtons.forEach((button) => {
                button.disabled = true;
                button.textContent = 'Logging out...';
            });
            try {
                await fetch('/api/logout/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${getaccessToken()}`,
                    },
                    body: JSON.stringify({ refresh: getRefreshToken() }),
                });
            } catch (error) {
                // Even if the API call fails, still log the user out locally.
            } finally {
                clearTokens();
                window.location.href = '/login/';
            }
        });
    });

    loadProfileName();
    loadMyTours();
    loadDashboardSummary();
});

async function loadProfileName() {
    const token = getaccessToken();
    if (!token) return;
    try {
        const response = await fetch('/api/profile/', { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('Could not load profile.');
        const user = await response.json();
        const name = user.full_name || user.email || 'traveler';
        setText('#userName', name);
        setText('#welcomeName', name.split(' ')[0]);
    } catch (error) {
        setText('#userName', 'Traveler');
    }
}

async function loadDashboardSummary() {
    const token = getaccessToken();
    if (!token) return;
    try {
        const response = await fetch('/dashboard/api/summary/', { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('Could not load summary.');
        const summary = await response.json();

        setText('#statTours', summary.total_tours);
        setText('#statMembers', summary.total_members);
        setText('#statExpenses', `$${Number(summary.total_expenses).toFixed(2)}`);

        const balance = Number(summary.balance);
        setText('#statBalance', `$${Math.abs(balance).toFixed(2)}`);
        const note = document.querySelector('#statBalanceNote');
        if (note) {
            if (balance > 0) {
                note.textContent = "You're owed money overall";
                note.className = 'mt-1 text-xs font-semibold text-emerald-600';
            } else if (balance < 0) {
                note.textContent = 'You owe money overall';
                note.className = 'mt-1 text-xs font-semibold text-red-500';
            } else {
                note.textContent = "You're all settled up";
                note.className = 'mt-1 text-xs font-semibold text-slate-400';
            }
        }
    } catch (error) {
        ['#statTours', '#statMembers', '#statExpenses', '#statBalance'].forEach((sel) => setText(sel, '--'));
    }
}

async function loadMyTours() {
    const token = getaccessToken();
    if (!token) return;
    try {
        const [createdResponse, joinedResponse] = await Promise.all([
            fetch('/api/tours/?scope=created', { headers: { Authorization: `Bearer ${token}` } }),
            fetch('/api/tours/?scope=joined', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!createdResponse.ok || !joinedResponse.ok) throw new Error('Could not load tours.');
        const created = await createdResponse.json();
        const joined = await joinedResponse.json();
        renderTours('createdTours', created.results || created);
        renderTours('joinedTours', joined.results || joined);
    } catch (error) {
        renderToursError('createdTours');
        renderToursError('joinedTours');
    }
}

function renderTours(containerId, tours) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!tours.length) {
        container.textContent = 'No tours yet.';
        return;
    }
    container.replaceChildren(...tours.map((tour) => {
        const link = document.createElement('a');
        link.href = `/tours/${tour.id}/`;
        link.className = 'block rounded-xl border border-slate-200 p-3 transition hover:border-indigo-400 hover:bg-indigo-50';
        const title = document.createElement('p');
        title.className = 'font-semibold text-slate-900';
        title.textContent = tour.title;
        const destination = document.createElement('p');
        destination.className = 'mt-1 text-sm text-slate-500';
        destination.textContent = tour.destination;
        link.append(title, destination);
        return link;
    }));
}

function renderToursError(containerId) {
    const container = document.getElementById(containerId);
    if (container) container.textContent = 'Unable to load tours.';
}

function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
}

async function fetchWithAuth(url, options = {}) {
    const refresh = getRefreshToken();
    if (!refresh) {
        throw new Error('No refresh token available');
    }
    try {
        const response = await fetch(url, options);
        if (response.status === 401) {
            const refreshResponse = await fetch('/api/token/refresh/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh }),
            });

            if (!refreshResponse.ok) {
                throw new Error('Refresh token request failed');
            }

            const { access: accessToken, refresh: newRefreshToken = refresh } = await refreshResponse.json();
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', newRefreshToken);

            const retryOptions = {
                ...options,
                headers: { ...(options.headers || {}), Authorization: `Bearer ${accessToken}` },
            };
            return fetch(url, retryOptions);
        }

        return response;
    } catch (error) {
        console.error('Fetch with auth failed:', error);
        throw error;
    }
}
