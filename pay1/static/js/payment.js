document.addEventListener("DOMContentLoaded", () => {
    const page = document.body;
    const tourId = page.dataset.tourId;
    const recipientId = Number(page.dataset.recipientId);
    const token = localStorage.getItem("access_token");
    const form = document.querySelector("#paymentForm");
    const transferDetails = document.querySelector("#transferDetails");
    const transferInstructions = document.querySelector("#transferInstructions");
    const accountDetails = document.querySelector("#recipientAccountDetails");
    const referenceInput = document.querySelector("#transactionReference");
    const methodInstructions = {
        raast: "Send money to the recipient Raast ID or IBAN using your bank app. Add the receipt reference if available.",
        easypaisa: "Send money to the recipient Easypaisa account. Add the transaction ID if available.",
        jazzcash: "Send money to the recipient JazzCash account. Add the transaction ID if available.",
    };
    let paymentAmount = null;
    let recipientPaymentDetails = null;

    if (!token) { window.location.href = "/login/"; return; }

    document.querySelector("#raastMethodTrigger").addEventListener("click", () => {
        const options = document.querySelector("#raastOptions");
        const isOpen = options.hidden;
        options.hidden = !isOpen;
        document.querySelector("#raastMethodTrigger").setAttribute("aria-expanded", String(isOpen));
    });

    form.querySelectorAll('input[name="payment_method"]').forEach((input) => {
        input.addEventListener("change", () => {
            const isCash = input.value === "cash";
            if (!input.checked) return;
            if (input.value === "bank") {
                window.location.href = `/tours/${tourId}/pay/${recipientId}/bank/`;
                return;
            }
            transferDetails.hidden = isCash;
            referenceInput.value = "";
            showMessage("");
            transferInstructions.textContent = methodInstructions[input.value] || "Send the amount using your chosen service, then submit it for recipient approval.";
            renderAccountDetails(input.value);
        });
    });

    fetch(`/api/tours/${tourId}/summary/`, { headers: { Authorization: `Bearer ${token}` } })
        .then(async (response) => {
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Unable to load payment details.");
            const you = data.members.find((member) => member.is_you);
            const recipient = data.members.find((member) => member.id === recipientId);
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
            if (!accountResponse.ok) throw new Error(accountData.detail || "Unable to load recipient account details.");
            recipientPaymentDetails = accountData;
            renderAccountDetails(form.querySelector('input[name="payment_method"]:checked').value);
            await handleCardCheckoutReturn();
        })
        .catch((error) => showMessage(error.message, true));

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!paymentAmount) { showMessage("Payment details are still loading.", true); return; }
        const submit = document.querySelector("#paymentSubmit");
        submit.disabled = true;
        submit.textContent = "Submitting...";
        try {
            const method = form.querySelector('input[name="payment_method"]:checked').value;
            const response = await fetch(`/api/tours/${tourId}/payments/`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    paid_to: recipientId,
                    amount: paymentAmount.toFixed(2),
                    payment_method: method,
                    transaction_reference: referenceInput.value.trim(),
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.detail || Object.values(data).flat().join(" ") || "Unable to submit payment.");
            showMessage("Payment submitted. Waiting for recipient approval.");
            submit.textContent = "Submitted for approval";
            setTimeout(() => { window.location.href = `/tours/${tourId}/`; }, 1300);
        } catch (error) {
            showMessage(error.message, true);
            submit.disabled = false;
            submit.textContent = "Submit for approval";
        }
    });

    function showMessage(message, isError = false) {
        const element = document.querySelector("#paymentMessage");
        element.textContent = message;
        element.style.color = isError ? "#b44737" : "#087a74";
    }

    async function handleCardCheckoutReturn() {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get("card_session");
        if (sessionId) {
            const response = await fetch(`/api/tours/${tourId}/payments/card-confirm/?session_id=${encodeURIComponent(sessionId)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.detail || "Unable to confirm card payment.");
            showMessage(data.success || "Card payment confirmed.");
            setTimeout(() => { window.location.href = `/tours/${tourId}/`; }, 1300);
        } else if (params.has("card_cancelled")) {
            const paymentId = params.get("payment_id");
            if (paymentId) {
                await fetch(`/api/tours/${tourId}/payments/card-cancel/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ payment_id: paymentId }),
                });
            }
            showMessage("Card checkout was cancelled. You can choose another payment method.", true);
        }
    }

    function renderAccountDetails(method) {
        if (!recipientPaymentDetails || method === "cash") {
            accountDetails.replaceChildren();
            return;
        }
        const d = recipientPaymentDetails;
        const fields = {
            bank: [["Bank", d.bank_name], ["Account title", d.bank_account_title], ["Account / IBAN", d.bank_account_number]],
            raast: [["Raast ID / IBAN", d.raast_id]],
            easypaisa: [["Easypaisa number", d.easypaisa_number]],
            jazzcash: [["JazzCash number", d.jazzcash_number]],
        }[method] || [];
        accountDetails.replaceChildren();
        const heading = document.createElement("p");
        heading.className = "account-heading";
        heading.textContent = `Send to ${d.full_name || "recipient"}`;
        accountDetails.append(heading);
        const populated = fields.filter(([, value]) => value);
        if (!populated.length) {
            const empty = document.createElement("p");
            empty.className = "account-empty";
            empty.textContent = "No account details added for this method yet. Contact the recipient or ask them to add their details in My Profile.";
            accountDetails.append(empty);
            return;
        }
        populated.forEach(([label, value]) => {
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

    function formatPKR(amount) {
        return `PKR ${new Intl.NumberFormat("en-PK", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount)}`;
    }
});
