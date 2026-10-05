let currentSearch = "";

let searchTimeout = null;

let currentPage = 1;

let totalTours = 0;

const toursPerPage = 5;

let selectedTourId = null;

let selectedTourTitle = "";


document.addEventListener("DOMContentLoaded", function () {

    checkAuthentication();

    setupSearch();

    setupPagination();

    setupTourActions();

    setupDeleteModal();


});



function setupDeleteModal() {

    const confirmDeleteBtn = document.getElementById(
        "confirmDeleteBtn"
    );


    const cancelDeleteBtn = document.getElementById(
        "cancelDeleteBtn"
    );


    const closeDeleteModalBtn = document.getElementById(
        "closeDeleteModalBtn"
    );


    const deleteModalOverlay = document.getElementById(
        "deleteModalOverlay"
    );


    // Confirm deletion

    confirmDeleteBtn.addEventListener(
        "click",
        function () {

            deleteTour();

        }
    );


    // Cancel deletion

    cancelDeleteBtn.addEventListener(
        "click",
        closeDeleteModal
    );


    // Close button

    closeDeleteModalBtn.addEventListener(
        "click",
        closeDeleteModal
    );


    // Click outside modal

    deleteModalOverlay.addEventListener(
        "click",
        closeDeleteModal
    );

}

function openDeleteModal(tourId, tourTitle) {

    selectedTourId = tourId;

    selectedTourTitle = tourTitle;


    const deleteModal = document.getElementById(
        "deleteModal"
    );


    const deleteModalMessage = document.getElementById(
        "deleteModalMessage"
    );


    deleteModalMessage.textContent =
        `Are you sure you want to delete "${tourTitle}"?`;


    deleteModal.classList.remove(
        "hidden"
    );


    document.body.classList.add(
        "overflow-hidden"
    );

}

function closeDeleteModal() {

    const deleteModal = document.getElementById(
        "deleteModal"
    );


    deleteModal.classList.add(
        "hidden"
    );


    document.body.classList.remove(
        "overflow-hidden"
    );


    selectedTourId = null;

    selectedTourTitle = "";

}

async function deleteTour() {

    if (!selectedTourId) {

        return;

    }

    const tourIdToDelete =
        selectedTourId;


    const tourTitleToDelete =
        selectedTourTitle;


    const token = localStorage.getItem(
        "access_token"
    );


    const confirmDeleteBtn = document.getElementById(
        "confirmDeleteBtn"
    );


    const originalButtonText =
        confirmDeleteBtn.textContent;


    confirmDeleteBtn.disabled = true;

    confirmDeleteBtn.textContent =
        "Deleting...";


    try {

        const response = await fetch(
            `/api/tours/${selectedTourId}/`,
            {

                method: "DELETE",

                headers: {

                    "Authorization": `Bearer ${token}`,

                },

            }
        );


        // Token expired or invalid

        if (response.status === 401) {

            handleUnauthorized();

            return;

        }


        // Tour does not exist or user does not own it

        if (response.status === 404) {

            closeDeleteModal();


            showMessage(
                "Tour not found or you do not have permission to delete it.",
                "error"
            );


            loadTours();

            return;

        }


        // Successful deletion

        if (response.status === 204) {

            closeDeleteModal();


            showMessage(
                `"${tourTitleToDelete}" deleted successfully.`,
                "success"
            );


            handlePageAfterDeletion();

            return;

        }


        // Other server errors

        let data = null;


        try {

            data = await response.json();

        }

        catch {

            // No JSON response

        }


        showMessage(
            getApiErrorMessage(data),
            "error"
        );

    }

    catch (error) {

        console.error(
            "Error deleting tour:",
            error
        );


        showMessage(
            "Unable to delete the tour. Please try again.",
            "error"
        );

    }

    finally {

        confirmDeleteBtn.disabled = false;

        confirmDeleteBtn.textContent =
            originalButtonText;

    }

}

function handlePageAfterDeletion() {

    const totalPagesBeforeDeletion =
        Math.ceil(
            totalTours / toursPerPage
        );


    const totalToursAfterDeletion =
        totalTours - 1;


    const totalPagesAfterDeletion =
        Math.ceil(
            totalToursAfterDeletion /
            toursPerPage
        );


    if (
        currentPage > totalPagesAfterDeletion &&
        currentPage > 1
    ) {

        currentPage--;

    }


    totalTours =
        totalToursAfterDeletion;


    loadTours();

}

function setupTourActions() {

    const tableBody = document.getElementById(
        "tourTableBody"
    );
    const tourCardList = document.getElementById("tourCardList");

    [tableBody, tourCardList].filter(Boolean).forEach((container) => container.addEventListener(
        "click",
        function (event) {

            // Edit button

            const editButton =
                event.target.closest(".editTourBtn");


            if (editButton) {

                const tourId =
                    editButton.dataset.tourId;


                window.location.href =
                    `/tours/edit/${tourId}/`;

                return;

            }

            const copyButton = event.target.closest(".copyJoinCodeBtn");
            if (copyButton) {
                copyJoinCode(copyButton.dataset.joinCode, copyButton);
                return;
            }

            const shareButton = event.target.closest(".shareJoinCodeBtn");
            if (shareButton) {
                shareJoinCode(shareButton.dataset.joinCode, shareButton.dataset.tourTitle);
                return;
            }


            // Delete button

            const deleteButton =
                event.target.closest(".deleteTourBtn");


            if (deleteButton) {

                const tourId =
                    deleteButton.dataset.tourId;


                const tourTitle =
                    deleteButton.dataset.tourTitle;


                openDeleteModal(
                    tourId,
                    tourTitle
                );

            }

        }
    ));

}

function setupSearch() {

    const searchForm = document.getElementById(
        "searchForm"
    );

    const searchInput = document.getElementById(
        "searchInput"
    );

    const clearSearchBtn = document.getElementById(
        "clearSearchBtn"
    );


    // Search when form is submitted

    searchForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            clearTimeout(searchTimeout);

            currentSearch = searchInput.value.trim();

            currentPage = 1;

            loadTours();

        }
    );


    // Clear Search Button

    clearSearchBtn.addEventListener(
        "click",
        function () {

            clearTimeout(searchTimeout);

            searchInput.value = "";

            currentSearch = "";


            currentPage = 1;

            loadTours();

        }
    );


    // Live Search with Debounce

    searchInput.addEventListener(
        "input",
        function () {

            clearTimeout(searchTimeout);


            searchTimeout = setTimeout(
                function () {

                    currentSearch = searchInput.value.trim();

                    currentPage = 1;

                    loadTours();

                },
                500
            );

        }
    );

}


function checkAuthentication() {

    const token = localStorage.getItem("access_token");

    if (!token) {

        window.location.href = "/login/";

        return;

    }

    loadTours();

}

function renderTours(tours) {

    const tableBody = document.getElementById(
        "tourTableBody"
    );
    const tourCardList = document.getElementById("tourCardList");

    tableBody.innerHTML = "";
    tourCardList.innerHTML = "";

    tours.forEach(function (tour) {

        const imageUrl = tour.image ? new URL(tour.image, window.location.origin).href : "";
        const thumbnail = imageUrl
            ? `<img src="${imageUrl}" alt="${escapeHtml(tour.title || "Tour cover")}" class="h-14 w-14 rounded-xl object-cover border border-gray-200 shadow-sm sm:h-20 sm:w-20" />`
            : `<div class="grid h-20 w-20 place-items-center rounded-xl border border-dashed border-gray-300 bg-gray-100 text-xl text-gray-400">📷</div>`;

        const row = `

            <tr class="hover:bg-gray-50 transition">

                <td class="px-3 py-3 align-middle sm:px-4 sm:py-4">
                    <div class="flex items-center justify-center">
                        <div class="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                            ${thumbnail}
                        </div>
                    </div>
                </td>

                <td class="px-3 py-3 sm:px-6 sm:py-4">
                    <div class="truncate font-semibold text-gray-800" title="${escapeHtml(tour.title)}">

                        ${escapeHtml(tour.title)}

                    </div>

                    <div class="mt-1 hidden text-sm text-gray-500 lg:block">

                        ${escapeHtml(
                            tour.description || "No description"
                        )}

                    </div>

                </td>

                <td class="hidden px-6 py-4 text-gray-700 xl:table-cell">

                    ${escapeHtml(tour.destination)}

                </td>

                <td class="hidden px-6 py-4 font-medium text-gray-800 xl:table-cell">

                    ${formatCurrency(tour.price)}

                </td>

                <td class="hidden px-6 py-4 text-sm text-gray-600 xl:table-cell">

                    ${escapeHtml(tour.states || "-")}

                </td>

                <td class="hidden px-6 py-4 xl:table-cell">

                    ${formatDate(tour.created_at)}

                </td>

                <td class="hidden px-6 py-4 xl:table-cell">
                    <div class="flex items-center gap-2">
                        <code class="rounded bg-blue-50 px-2 py-1 text-sm font-bold tracking-wider text-blue-800">${escapeHtml(tour.join_code || "-")}</code>
                        <button type="button" class="copyJoinCodeBtn text-sm font-semibold text-blue-600 hover:text-blue-800" data-join-code="${escapeHtml(tour.join_code || "")}">Copy</button>
                        <button type="button" class="shareJoinCodeBtn text-sm font-semibold text-blue-600 hover:text-blue-800" data-join-code="${escapeHtml(tour.join_code || "")}" data-tour-title="${escapeHtml(tour.title)}">Share</button>
                    </div>
                </td>

                <td class="px-3 py-3 text-right sm:px-6 sm:py-4">

                    <div class="flex flex-col items-end gap-1 text-sm lg:flex-row lg:flex-wrap lg:justify-end lg:gap-3 lg:text-base">

                    <a  href="/tours/${tour.id}/"
                        class="whitespace-nowrap font-semibold text-green-600 hover:text-green-800">

                        View

                    </a>
                    
                    <button
                        type="button"
                        class="editTourBtn whitespace-nowrap font-semibold text-blue-600 hover:text-blue-800"
                        data-tour-id="${tour.id}">

                        Edit

                    </button>

                    <button
                        type="button"
                        class="deleteTourBtn whitespace-nowrap font-semibold text-red-600 hover:text-red-800"
                        data-tour-id="${tour.id}"
                        data-tour-title="${escapeHtml(tour.title)}">

                        Delete

                    </button>
                    </div>

                </td>

            </tr>

        `;

        tableBody.insertAdjacentHTML(
            "beforeend",
            row
        );

        const card = `
            <article class="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:gap-5 sm:p-4">
                <div class="shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">${thumbnail}</div>
                <div class="min-w-0 flex-1">
                    <h3 class="truncate font-bold text-slate-900" title="${escapeHtml(tour.title)}">${escapeHtml(tour.title)}</h3>
                    <p class="mt-1 truncate text-sm text-slate-500">${escapeHtml(tour.destination || "Your tour")}</p>
                    <div class="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-sm font-semibold">
                        <a href="/tours/${tour.id}/" class="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-emerald-700 hover:bg-emerald-100">View</a>
                        <button type="button" class="editTourBtn rounded-lg bg-blue-50 px-2.5 py-1.5 text-blue-700 hover:bg-blue-100" data-tour-id="${tour.id}">Edit</button>
                        <button type="button" class="deleteTourBtn rounded-lg bg-rose-50 px-2.5 py-1.5 text-rose-700 hover:bg-rose-100" data-tour-id="${tour.id}" data-tour-title="${escapeHtml(tour.title)}">Delete</button>
                    </div>
                </div>
            </article>`;
        tourCardList.insertAdjacentHTML("beforeend", card);

    });

}


async function copyJoinCode(joinCode, button) {
    if (!joinCode) return;
    try {
        await navigator.clipboard.writeText(joinCode);
        const original = button.textContent;
        button.textContent = "Copied!";
        setTimeout(() => { button.textContent = original; }, 1500);
    } catch {
        showMessage("Could not copy the join code. Please copy it manually.", "error");
    }
}

async function shareJoinCode(joinCode, title) {
    if (!joinCode) return;
    const text = `Join my PayTogether tour${title ? `, ${title}` : ""}, with code: ${joinCode}`;
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
        showMessage("Invite message copied. Share it with your members.", "success");
    } catch {
        showMessage(text, "success");
    }
}


function formatCurrency(amount) {

    const number = Number(amount || 0);

    return new Intl.NumberFormat(
        "en-PK",
        {
            style: "currency",
            currency: "PKR",
            currencyDisplay: "code",
            minimumFractionDigits: 2,
        }
    ).format(number);

}


function formatDate(dateString) {

    if (!dateString) {

        return "-";

    }

    const date = new Date(dateString);

    return new Intl.DateTimeFormat(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric",
        }
    ).format(date);

}


function getStatusBadge(status) {

    const statusMap = {

        planned: {
            label: "Planned",
            classes: "bg-blue-100 text-blue-700"
        },

        ongoing: {
            label: "Ongoing",
            classes: "bg-yellow-100 text-yellow-700"
        },

        completed: {
            label: "Completed",
            classes: "bg-green-100 text-green-700"
        },

        cancelled: {
            label: "Cancelled",
            classes: "bg-red-100 text-red-700"
        }

    };


    const statusData = statusMap[status] || {

        label: status || "Unknown",
        classes: "bg-gray-100 text-gray-700"

    };


    return `

        <span
            class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusData.classes}">

            ${escapeHtml(statusData.label)}

        </span>

    `;

}


function escapeHtml(value) {

    const text = String(value ?? "");

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


async function loadTours() {

    const token = localStorage.getItem("access_token");

    
    showLoading();

    const params = new URLSearchParams();

    params.set("page", currentPage);
    

    if (currentSearch.trim() !== "") {

        params.set(
            "search",
            currentSearch.trim()
        );

    }

    let apiUrl = `/api/tours/?${params.toString()}`;

    // if (currentSearch.trim() !== "") {

    //     apiUrl += `?search=${encodeURIComponent(
    //         currentSearch.trim()
    //     )}`;
        

    // }
    
    try {

        const response = await fetch(apiUrl, {

            method: "GET",

            headers: {

                "Authorization": `Bearer ${token}`,

                "Content-Type": "application/json",

            },
            

        });


        if (response.status === 401) {

            handleUnauthorized();

            return;

        }


        if (!response.ok) {

            throw new Error(
                "Unable to load tours."
            );

        }


        const data = await response.json();

        console.log("Tour API Response:", data);

        totalTours = data.count;

        if (data.count === 0) {

            showEmptyState();

            updatePagination(null, null);

            return;

        }


        showTableContainer();


        renderTours(data.results);

        updatePagination(
            data.next,
            data.previous
        );

        

    }

    catch (error) {

        

        console.error(
            "Error loading tours:",
            error
        );

        showError(
            "Unable to load tours. Please try again."
        );

    }

}





function setupPagination() {

    const previousPageBtn = document.getElementById(
        "previousPageBtn"
    );

    const nextPageBtn = document.getElementById(
        "nextPageBtn"
    );


    previousPageBtn.addEventListener(
        "click",
        function () {

            if (currentPage > 1) {

                currentPage--;

                loadTours();

            }

        }
    );


    nextPageBtn.addEventListener(
        "click",
        function () {

            const totalPages = Math.ceil(
                totalTours / toursPerPage
            );


            if (currentPage < totalPages) {

                currentPage++;

                loadTours();

            }

        }
    );

}


function updatePagination(nextUrl, previousUrl) {

    const paginationContainer = document.getElementById(
        "paginationContainer"
    );

    const previousPageBtn = document.getElementById(
        "previousPageBtn"
    );

    const nextPageBtn = document.getElementById(
        "nextPageBtn"
    );

    const currentPageInfo = document.getElementById(
        "currentPageInfo"
    );

    const paginationInfo = document.getElementById(
        "paginationInfo"
    );


    if (totalTours === 0) {

        paginationContainer.classList.add("hidden");

        return;

    }


    paginationContainer.classList.remove("hidden");


    const totalPages = Math.ceil(
        totalTours / toursPerPage
    );


    const startItem =
        ((currentPage - 1) * toursPerPage) + 1;


    const endItem = Math.min(
        currentPage * toursPerPage,
        totalTours
    );


    paginationInfo.textContent =
        `Showing ${startItem}–${endItem} of ${totalTours} tours`;


    currentPageInfo.textContent =
        `Page ${currentPage} of ${totalPages}`;


    previousPageBtn.disabled = !previousUrl;

    nextPageBtn.disabled = !nextUrl;

}



function showLoading() {

    document
        .getElementById("loadingState")
        .classList
        .remove("hidden");


    document
        .getElementById("emptyState")
        .classList
        .add("hidden");


    document
        .getElementById("tableContainer")
        .classList
        .add("hidden");

    document.getElementById("tourCardContainer").classList.add("hidden");

    document
        .getElementById("paginationContainer")
        .classList
        .add("hidden");


    document
        .getElementById("messageArea")
        .innerHTML = "";

}


function showEmptyState() {

    document
        .getElementById("loadingState")
        .classList
        .add("hidden");


    document
        .getElementById("emptyState")
        .classList
        .remove("hidden");


    document
        .getElementById("tableContainer")
        .classList
        .add("hidden");

    document.getElementById("tourCardContainer").classList.add("hidden");

    document
    .getElementById("paginationContainer")
    .classList
    .add("hidden");


    const title = document.getElementById(
        "emptyStateTitle"
    );

    const message = document.getElementById(
        "emptyStateMessage"
    );

    const button = document.getElementById(
        "emptyStateButton"
    );


    if (currentSearch.trim() !== "") {

        title.textContent = "No Matching Tours";

        message.textContent =
            `We couldn't find any tours matching "${currentSearch}".`;

        button.classList.add("hidden");

    }

    else {

        title.textContent = "No Tours Found";

        message.textContent =
            "You haven't created any tours yet.";

        button.classList.remove("hidden");

    }

}

function showTableContainer() {

    document
        .getElementById("loadingState")
        .classList
        .add("hidden");


    document
        .getElementById("emptyState")
        .classList
        .add("hidden");


    document
        .getElementById("tableContainer")
        .classList
        .remove("hidden");

    document.getElementById("tourCardContainer").classList.remove("hidden");

}


function showMessage(message, type) {

    const messageArea = document.getElementById(
        "messageArea"
    );


    const styles = {

        success:
            "bg-green-100 border border-green-300 text-green-700",

        error:
            "bg-red-100 border border-red-300 text-red-700"

    };


    messageArea.innerHTML = `

        <div class="${styles[type] || styles.error} px-5 py-4 rounded-lg">

            ${escapeHtml(message)}

        </div>

    `;

}


function handleUnauthorized() {

    localStorage.removeItem("access_token");

    localStorage.removeItem("refresh_token");


    window.location.href = "/login/";

}


function showError(message) {

    document
        .getElementById("loadingState")
        .classList
        .add("hidden");


    document
        .getElementById("emptyState")
        .classList
        .add("hidden");


    document
        .getElementById("tableContainer")
        .classList
        .add("hidden");

    document.getElementById("tourCardContainer").classList.add("hidden");


    document
        .getElementById("messageArea")
        .innerHTML = `

            <div class="bg-red-100 border border-red-300 text-red-700 px-5 py-4 rounded-lg">

                ${message}

            </div>

        `;

}
