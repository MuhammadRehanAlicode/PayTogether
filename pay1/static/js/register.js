function getCookie(name) {
    const cookieValue = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`));

    return cookieValue ? decodeURIComponent(cookieValue.split('=')[1]) : "";
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("#registerForm");
    const submitButton = form?.querySelector('button[type="submit"]');

    if (!form || !submitButton) return;

    const message = document.createElement("p");
    message.className = "text-sm";
    form.appendChild(message);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        message.textContent = "";

        const payload = {
            email: form.elements.email.value.trim(),
            full_name: form.elements.full_name.value.trim(),
            password: form.elements.password.value,
            confirm_password: form.elements.confirm_password.value,
        };

        const csrfToken = getCookie("csrftoken");

        submitButton.disabled = true;
        submitButton.textContent = "Creating account...";

        try {
            const response = await fetch("/api/register/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (!response.ok) {
                const error = data.non_field_errors?.[0] || data.email?.[0] || data.full_name?.[0] || "Could not create your account.";
                throw new Error(error);
            }

            message.className = "text-sm text-green-600";
            message.textContent = "Account created. Redirecting to sign in...";
            window.location.href = "/login/";
        } catch (error) {
            message.className = "text-sm text-red-600";
            message.textContent = error.message;
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Create account";
        }
    });
});
