function getCookie(name) {
    const cookieValue = document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${name}=`));

    return cookieValue ? decodeURIComponent(cookieValue.split('=')[1]) : "";
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("#loginForm");

    if (!form) {
        return;
    }

    const emailInput = document.querySelector("#email");
    const passwordInput = document.querySelector("#password");
    const submitButton = form.querySelector('button[type="submit"]');

    const message = document.createElement("p");
    message.style.marginTop = "12px";
    form.appendChild(message);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        message.textContent = "";
        submitButton.disabled = true;
        submitButton.textContent = "Logging in...";

        const csrfToken = getCookie("csrftoken");

        try {
            const response = await fetch(form.action, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
                },
                credentials: "same-origin",
                body: JSON.stringify({
                    email: emailInput.value.trim(),
                    password: passwordInput.value,
                }),
            });

            const data = await response.json().catch(() => ({}));

            console.log("Login response:", data);

            if (!response.ok) {
                const error =
                    data.non_field_errors?.[0] ||
                    data.email?.[0] ||
                    data.password?.[0] ||
                    "Invalid email or password.";

                throw new Error(error);
            }

            // Save JWT tokens
            localStorage.setItem("access_token", data.access);
            localStorage.setItem("refresh_token", data.refresh);

            message.style.color = "green";
            message.textContent = data.success || "Login successful!";

            // Go to dashboard
            window.location.href = "/dashboard/";

        } catch (error) {
            console.error("Login error:", error);

            message.style.color = "red";
            message.textContent = error.message;

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Sign In →";
        }
    });
});