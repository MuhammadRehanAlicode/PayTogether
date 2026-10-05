document.addEventListener("DOMContentLoaded", () => {
    const page = document.body;
    const tourId = page.dataset.tourId;
    const recipientId = Number(page.dataset.recipientId);
    const token = localStorage.getItem("access_token");
    const form = document.querySelector("#paymentForm");
    const transferDetails = document.querySelector("#transferDetails");
    const transferInstructions = document.querySelector("#transferInstructions");
    const referenceInput = document.querySelector("#transactionReference");
    const methodInstructions = {
        bank: "Transfer the amount to the recipient using the bank details they shared with you. Add the receipt reference if available.",
        raast: "Send money to the recipient Raast ID or IBAN using your bank app. Add the receipt reference if available.",
        easypaisa: "Send money to the recipient Easypaisa account. Add the transaction ID if available.",
        jazzcash: "Send money to the recipient JazzCash account. Add the transaction ID if available.",
    };
    let paymentAmount = null;

    if (!token) { window.location.href = "/login/"; return; }

    form.querySelectorAll('input[name="payment_method"]').forEach((input) => {
        input.addEventListener("change", () => {
            const isCash = input.value === "cash";
            if (!input.checked) return;
            transferDetails.hidden = isCash;
            referenceInput.value = "";
            transferInstructions.textContent = methodInstructions[input.value] || "Send the amount using your chosen service, then submit it for recipient approval.";
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

    function formatPKR(amount) {
        return `PKR ${new Intl.NumberFormat("en-PK", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount)}`;
    }
});
