document.addEventListener("DOMContentLoaded", () => {
    const page = document.body;
    const tourId = page.dataset.tourId;
    const recipientId = Number(page.dataset.recipientId);
    const token = localStorage.getItem("access_token");
    const form = document.querySelector("#bankTransferForm");
    const accountDetails = document.querySelector("#recipientAccountDetails");
    let paymentAmount = null;

    if (!token) {
        window.location.href = "/login/";
        return;
    }

    loadPaymentDetails();

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!paymentAmount) {
            showMessage("Payment details are still loading.", true);
            return;
        }

        const submit = document.querySelector("#bankTransferSubmit");
        submit.disabled = true;
        submit.textContent = "Submitting...";

        try {
            const response = await fetch(`/api/tours/${tourId}/payments/`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    paid_to: recipientId,
                    amount: paymentAmount.toFixed(2),
                    payment_method: "bank",
                    payer_bank_name: document.querySelector("#payerBankName").value.trim(),
                    payer_account_title: document.querySelector("#payerAccountTitle").value.trim(),
                    payer_account_number: document.querySelector("#payerAccountNumber").value.trim(),
                    transaction_reference: document.querySelector("#transactionReference").value.trim(),
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.detail || Object.values(data).flat().join(" ") || "Unable to submit payment.");
            }
            showMessage("Bank transfer submitted. Waiting for recipient approval.");
            submit.textContent = "Submitted for approval";
            setTimeout(() => { window.location.href = `/tours/${tourId}/`; }, 1300);
        } catch (error) {
            showMessage(error.message, true);
            submit.disabled = false;
            submit.textContent = "Submit bank transfer for approval";
        }
    });

    async function loadPaymentDetails() {
        try {
            const summaryResponse = await fetch(`/api/tours/${tourId}/summary/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const summary = await summaryResponse.json();
            if (!summaryResponse.ok) {
                throw new Error(summary.detail || "Unable to load payment details.");
            }

            const you = summary.members.find((member) => member.is_you);
            const recipient = summary.members.find((member) => member.id === recipientId);
            if (!you || !recipient || Number(you.balance) >= 0 || Number(recipient.balance) <= 0) {
                throw new Error("This payment is no longer required.");
            }

            paymentAmount = Math.min(Math.abs(Number(you.balance)), Number(recipient.balance));
            document.querySelector("#recipientName").textContent = recipient.full_name || recipient.email;
            document.querySelector("#paymentAmount").textContent = formatPKR(paymentAmount);

            const accountResponse = await fetch(`/api/tours/${tourId}/payment-details/${recipientId}/`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const accountData = await accountResponse.json();
            if (!accountResponse.ok) {
                throw new Error(accountData.detail || "Unable to load recipient bank details.");
            }
            renderAccountDetails(accountData);
        } catch (error) {
            showMessage(error.message, true);
            accountDetails.innerHTML = `<p class="account-empty">${escapeHtml(error.message)}</p>`;
        }
    }

    function renderAccountDetails(details) {
        const rows = [
            ["Bank", details.bank_name],
            ["Account title", details.bank_account_title],
            ["Account / IBAN", details.bank_account_number],
        ].filter(([, value]) => value);

        if (!rows.length) {
            accountDetails.innerHTML = '<p class="account-empty">No bank details added yet. Contact the recipient or ask them to add bank details in My Profile.</p>';
            return;
        }

        accountDetails.replaceChildren();
        const heading = document.createElement("p");
        heading.className = "account-heading";
        heading.textContent = `Send to ${details.full_name || "recipient"}`;
        accountDetails.append(heading);

        rows.forEach(([label, value]) => {
            const row = document.createElement("div");
            row.className = "account-value";
            const name = document.createElement("span");
            name.textContent = label;
            const content = document.createElement("strong");
            content.textContent = value;
            row.append(name, content);
            accountDetails.append(row);
        });
    }

    function showMessage(message, isError = false) {
        const element = document.querySelector("#paymentMessage");
        element.textContent = message;
        element.style.color = isError ? "#b44737" : "#087a74";
    }

    function formatPKR(amount) {
        return `PKR ${new Intl.NumberFormat("en-PK", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount)}`;
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
});
