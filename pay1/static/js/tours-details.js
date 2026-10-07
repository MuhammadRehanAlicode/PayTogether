document.addEventListener("DOMContentLoaded", () => {
    loadTourDetails();
    initExpenseLedger();
});

async function loadTourDetails() {
    const tourId = getTourIdFromPath();

    if (!tourId) {
        showTourError("The requested tour could not be identified.");
        return;
    }

    const token = localStorage.getItem("access_token");

    if (!token) {
        window.location.href = "/";
        return;
    }

    try {
        const response = await fetch(`/api/tours/${tourId}/`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            window.location.href = "/";
            return;
        }

        if (response.status === 404) {
            showTourError("Tour not found or you do not have permission to view it.");
            return;
        }

        if (!response.ok) {
            throw new Error(`Tour request failed with status ${response.status}`);
        }

        renderTourDetails(await response.json(), tourId);
    } catch (error) {
        console.error("Unable to load tour details:", error);
        showTourError("We could not load this tour right now. Please try again.");
    }
}

function getTourIdFromPath() {
    const match = window.location.pathname.match(/\/tours\/(\d+)\/?$/);
    return match ? match[1] : null;
}

function renderTourDetails(tour, tourId) {
    const title = tour.title || "Your next adventure awaits";
    const destination = tour.destination || "Destination to be discovered";
    const description = tour.description || "Gather your favorite people and make room for the moments you will talk about for years.";
    const price = tour.price === null || tour.price === undefined || tour.price === ""
        ? "0.00"
        : Number(tour.price).toFixed(2);

    setText(".crumb", `Tour no. ${tour.id || tourId}`);
    setText("#tour-title", title);
    setText(".destination", `◉ ${destination}`);
    setText(".description", description);
    setText(".price", formatPKR(price));

    const details = document.querySelectorAll(".detail-value");
    if (details.length >= 3) {
        details[0].textContent = destination;
        details[1].textContent = tour.states || "Not specified";
        details[2].textContent = formatDate(tour.created_at);
    }

    setText(".story-copy", description);

    const joinCodePanel = document.querySelector("#joinCodePanel");
    const joinCodeValue = document.querySelector("#joinCodeValue");
    if (tour.join_code && joinCodePanel && joinCodeValue) {
        joinCodeValue.textContent = tour.join_code;
        joinCodePanel.classList.add("visible");
        configureJoinCodeActions(tour.join_code, title);
    }

    const heroImage = document.querySelector(".hero-image");
    if (heroImage && tour.image) {
        const imageUrl = new URL(tour.image, window.location.origin).href;
        heroImage.style.backgroundImage = `linear-gradient(135deg, rgba(8, 76, 74, .3), rgba(231, 124, 91, .08)), url("${imageUrl}")`;
        heroImage.setAttribute("aria-label", `Photo of ${destination}`);
    }

    document.title = `${title} | PayTogether`;
}

function configureJoinCodeActions(joinCode, title) {
    document.querySelector("#copyJoinCode")?.addEventListener("click", async (event) => {
        try {
            await navigator.clipboard.writeText(joinCode);
            event.currentTarget.textContent = "Copied!";
            setTimeout(() => { event.currentTarget.textContent = "Copy code"; }, 1500);
        } catch {
            window.prompt("Copy this join code:", joinCode);
        }
    });
    document.querySelector("#shareJoinCode")?.addEventListener("click", async () => {
        const text = `Join my PayTogether tour, ${title}, with code: ${joinCode}`;
        if (navigator.share) {
            try {
                await navigator.share({ title: "Join a PayTogether tour", text });
                return;
            } catch (error) {
                if (error.name === "AbortError") return;
            }
        }
        try {
            await navigator.clipboard.writeText(text);
            window.alert("Invite message copied. Share it with your members.");
        } catch {
            window.prompt("Share this invite:", text);
        }
    });
}

function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) {
        element.textContent = value;
    }
}

function formatDate(value) {
    if (!value) {
        return "Recently";
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Recently"
        : new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
        }).format(date);
}

function showTourError(message) {
    setText(".description", message);
}

/* ---------------------------------------------------------------------
 * Expense ledger (FR6, FR7, FR8): add expenses, view the group balance,
 * and edit or delete expenses the current user added.
 * ------------------------------------------------------------------- */

function initExpenseLedger() {
    const tourId = getTourIdFromPath();
    const token = localStorage.getItem("access_token");
    const form = document.querySelector("#expenseForm");

    if (!tourId || !token || !form) {
        return;
    }

    loadSummary(tourId, token);
    loadExpenses(tourId, token);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitButton = document.querySelector("#expenseSubmit");
        const messageEl = document.querySelector("#expenseFormMessage");
        setFormMessage(messageEl, "");

        const payload = {
            title: document.querySelector("#expenseTitle").value.trim(),
            amount: document.querySelector("#expenseAmount").value,
            notes: document.querySelector("#expenseNotes").value.trim(),
        };

        submitButton.disabled = true;
        submitButton.textContent = "Adding...";

        try {
            const response = await fetch(`/api/tours/${tourId}/expenses/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(formatExpenseErrors(data) || "Unable to add this expense.");
            }

            form.reset();
            setFormMessage(messageEl, "Expense added.", false);
            loadSummary(tourId, token);
            loadExpenses(tourId, token);
        } catch (error) {
            setFormMessage(messageEl, error.message, true);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Add expense";
        }
    });
}

async function loadSummary(tourId, token) {
    try {
        const response = await fetch(`/api/tours/${tourId}/summary/`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Unable to load the balance.");
        renderSummary(await response.json());
    } catch (error) {
        const memberList = document.querySelector("#memberList");
        if (memberList) memberList.innerHTML = '<p class="empty-note">Unable to load the group balance.</p>';
    }
}

function renderSummary(summary) {
    setText("#summaryTotal", formatPKR(summary.total_expenses));
    setText("#summaryMembers", String(summary.member_count));
    setText("#summaryShare", formatPKR(summary.share_per_member));

    const memberList = document.querySelector("#memberList");
    if (!memberList) return;

    if (!summary.members || !summary.members.length) {
        memberList.innerHTML = '<p class="empty-note">No members yet.</p>';
        return;
    }

    const currentMember = summary.members.find((member) => member.is_you);
    const currentBalance = Number(currentMember?.balance || 0);
    renderSettlementRecommendation(summary, currentMember);

    memberList.replaceChildren();
    renderPendingPayments(summary, memberList);
    memberList.append(...summary.members.map((member) => {
        const row = document.createElement("div");
        row.className = "member-row";

        const balance = Number(member.balance);
        const balanceClass = balance > 0 ? "positive" : balance < 0 ? "negative" : "zero";
        const balanceLabel = balance > 0
            ? `is owed ${formatPKR(balance)}`
            : balance < 0
                ? `owes ${formatPKR(Math.abs(balance))}`
                : "settled up";
        const paymentStatus = member.payment_status === "unpaid" ? "Unpaid" : "Paid";

        row.innerHTML = `
            <span class="member-name">${escapeHtml(member.full_name || member.email)}${member.is_you ? '<span class="tag">You</span>' : ''}${member.is_organizer ? '<span class="tag">Organizer</span>' : ''}</span>
            <span class="member-figures">Expense paid ${formatPKR(member.paid)}<span class="balance ${balanceClass}">${balanceLabel}</span><span class="payment-status ${member.payment_status}">${paymentStatus}</span></span>
        `;

        // Only a member who owes money can mark a payment to a member who is owed.
        if (currentBalance < 0 && balance > 0) {
            const amount = Math.min(Math.abs(currentBalance), balance);
            const payButton = document.createElement("button");
            payButton.type = "button";
            payButton.className = "pay-button";
            payButton.textContent = `Pay ${formatPKR(amount)}`;
            payButton.addEventListener("click", () => {
                window.location.href = `/tours/${summary.tour_id}/pay/${member.id}/`;
            });
            row.appendChild(payButton);
        }
        return row;
    }));
}

function renderSettlementRecommendation(summary, currentMember) {
    const card = document.querySelector("#settlementCard");
    const title = document.querySelector("#settlementTitle");
    const copy = document.querySelector("#settlementCopy");
    const button = document.querySelector("#settleNowButton");
    if (!card || !currentMember || Number(currentMember.balance) >= 0) {
        if (card) card.hidden = true;
        return;
    }
    const recipient = summary.members.find((member) => Number(member.balance) > 0);
    if (!recipient) return;
    const amount = Math.min(Math.abs(Number(currentMember.balance)), Number(recipient.balance));
    const pending = (summary.pending_payments || []).some((payment) => payment.is_your_payment);
    card.hidden = false;
    if (pending) {
        title.textContent = "Your payment is being reviewed";
        copy.textContent = "Once the recipient approves it, your group balance will update automatically.";
        button.textContent = "View pending payment";
        button.onclick = () => document.querySelector(".approval-row")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }
    title.textContent = `Pay ${recipient.full_name || recipient.email}`;
    copy.textContent = `You owe ${formatPKR(amount)}. Pay by cash, bank, Raast, Easypaisa, or JazzCash; the recipient confirms receipt.`;
    button.textContent = `Pay ${formatPKR(amount)}`;
    button.onclick = () => { window.location.href = `/tours/${summary.tour_id}/pay/${recipient.id}/`; };
}

function renderPendingPayments(summary, memberList) {
    const awaitingApproval = (summary.pending_payments || []).filter((payment) => payment.is_awaiting_your_approval);
    const submittedByYou = (summary.pending_payments || []).filter((payment) => payment.is_your_payment);

    awaitingApproval.forEach((payment) => {
        const row = document.createElement("div");
        row.className = "member-row approval-row";
        const methodName = paymentMethodName(payment.payment_method);
        const reference = payment.transaction_reference ? `<small>Reference: ${escapeHtml(payment.transaction_reference)}</small>` : "";
        const transferDetails = payment.payment_method === "bank" && payment.payer_account_number
            ? `<small>From ${escapeHtml(payment.payer_bank_name)} · ${escapeHtml(payment.payer_account_title)} · ${escapeHtml(payment.payer_account_number)}</small>`
            : "";
        row.innerHTML = `<span class="member-name">${escapeHtml(payment.paid_by_name)} sent a ${methodName} payment${reference}${transferDetails}</span><span class="member-figures">${formatPKR(payment.amount)}<span class="payment-status unpaid">Approval needed</span></span>`;
        const approveButton = document.createElement("button");
        approveButton.type = "button";
        approveButton.className = "pay-button";
        approveButton.textContent = "Approve payment";
        approveButton.addEventListener("click", () => approvePayment(summary.tour_id, payment.id, approveButton));
        row.appendChild(approveButton);
        memberList.appendChild(row);
    });

    submittedByYou.forEach((payment) => {
        const row = document.createElement("div");
        row.className = "member-row approval-row";
        const methodName = paymentMethodName(payment.payment_method);
        const reference = payment.transaction_reference ? ` · Ref ${escapeHtml(payment.transaction_reference)}` : "";
        row.innerHTML = `<span class="member-name">Payment to ${escapeHtml(payment.paid_to_name)}</span><span class="member-figures">${formatPKR(payment.amount)} by ${methodName}${reference}<span class="payment-status unpaid">Waiting for approval</span></span>`;
        memberList.appendChild(row);
    });
}

function paymentMethodName(method) {
    return ({ cash: "cash", bank: "bank", card: "card", raast: "Raast", easypaisa: "Easypaisa", jazzcash: "JazzCash" })[method] || "payment";
}

async function approvePayment(tourId, paymentId, button) {
    const token = localStorage.getItem("access_token");
    button.disabled = true;
    button.textContent = "Approving...";
    try {
        const response = await fetch(`/api/tours/${tourId}/payments/${paymentId}/approve/`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(formatExpenseErrors(data) || "Unable to approve the payment.");
        loadSummary(tourId, token);
    } catch (error) {
        window.alert(error.message || "Unable to approve the payment.");
        button.disabled = false;
        button.textContent = "Approve payment";
    }
}

async function loadExpenses(tourId, token) {
    try {
        const response = await fetch(`/api/tours/${tourId}/expenses/`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Unable to load expenses.");
        const data = await response.json();
        renderExpenses(data.results || data, tourId, token);
    } catch (error) {
        const list = document.querySelector("#expenseList");
        if (list) list.innerHTML = '<p class="empty-note">Unable to load expenses.</p>';
    }
}

function renderExpenses(expenses, tourId, token) {
    const list = document.querySelector("#expenseList");
    if (!list) return;

    if (!expenses.length) {
        list.innerHTML = '<p class="empty-note">No expenses logged yet. Add the first one above.</p>';
        return;
    }

    list.replaceChildren(...expenses.map((expense) => {
        const item = document.createElement("div");
        item.className = "expense-item";

        const info = document.createElement("div");
        info.innerHTML = `
            <p class="title">${escapeHtml(expense.title)}</p>
            <p class="meta">Paid by ${escapeHtml(expense.paid_by?.full_name || expense.paid_by?.email || "someone")} &middot; ${formatDate(expense.created_at)}${expense.notes ? ` &middot; ${escapeHtml(expense.notes)}` : ""}</p>
        `;

        const right = document.createElement("div");
        right.style.textAlign = "right";
        const amount = document.createElement("p");
        amount.className = "amount";
        amount.textContent = formatPKR(expense.amount);
        right.appendChild(amount);

        if (expense.can_edit) {
            const actions = document.createElement("div");
            actions.className = "actions";

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "danger";
            deleteBtn.textContent = "Delete";
            deleteBtn.addEventListener("click", () => deleteExpense(tourId, expense.id, token));

            actions.appendChild(deleteBtn);
            right.appendChild(actions);
        }

        item.append(info, right);
        return item;
    }));
}

async function deleteExpense(tourId, expenseId, token) {
    if (!window.confirm("Remove this expense?")) return;
    try {
        const response = await fetch(`/api/tours/${tourId}/expenses/${expenseId}/`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok && response.status !== 204) throw new Error("Unable to delete this expense.");
        loadSummary(tourId, token);
        loadExpenses(tourId, token);
    } catch (error) {
        window.alert(error.message || "Unable to delete this expense.");
    }
}

function setFormMessage(element, text, isError = false) {
    if (!element) return;
    element.textContent = text;
    element.style.color = isError ? "#c1462f" : "#1a7a4c";
}

function formatExpenseErrors(errors) {
    if (!errors) return "";
    if (typeof errors.detail === "string") return errors.detail;
    return Object.entries(errors)
        .map(([field, values]) => `${field}: ${Array.isArray(values) ? values.join(", ") : values}`)
        .join(" | ");
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

function formatPKR(amount) {
    const value = Number(amount);
    const formatted = new Intl.NumberFormat("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
    return `PKR ${formatted}`;
}
