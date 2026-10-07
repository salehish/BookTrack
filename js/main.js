// BookTrack main JavaScript file

const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const searchButton = document.querySelector("#search-button");

const bookResults = document.querySelector("#book-results");
const loadingMessage = document.querySelector("#loading-message");
const errorMessage = document.querySelector("#error-message");
const emptyMessage = document.querySelector("#empty-message");
const resultsCount = document.querySelector("#results-count");

const readingListBooks = document.querySelector("#reading-list-books");
const readingListEmpty = document.querySelector("#reading-list-empty");
const readingListCount = document.querySelector("#reading-list-count");

const OPEN_LIBRARY_API = "https://openlibrary.org/search.json";
const GUTENDEX_API = "https://gutendex.com/books";
const STORAGE_KEY = "booktrack-reading-list";

let readingList = loadReadingList();

searchForm.addEventListener("submit", handleSearch);

function loadReadingList() {
    try {
        const savedBooks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

        return savedBooks.map((book) => ({
            ...book,
            readingStatus: book.readingStatus || "Want to Read",
            progress: Number.isFinite(Number(book.progress))
                ? Number(book.progress)
                : 0,
        }));
    } catch (error) {
        console.error("Unable to load reading list:", error);
        return [];
    }
}

function saveReadingList() {
    const readingListData = readingList.map((book) => ({
        key: book.key,
        title: book.title,
        author_name: book.author_name || [],
        cover_i: book.cover_i || null,
        first_publish_year: book.first_publish_year || null,
        subject: book.subject || [],
        readingStatus: book.readingStatus || "Want to Read",
        progress: Number(book.progress) || 0,
    }));

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(readingListData)
    );
}

async function handleSearch(event) {
    event.preventDefault();

    const query = searchInput.value.trim();

    if (!query) {
        return;
    }

    setLoadingState(true);
    clearMessages();
    bookResults.innerHTML = "";
    resultsCount.textContent = "";

    try {
        const url =
            `${OPEN_LIBRARY_API}?q=${encodeURIComponent(query)}` +
            `&limit=12` +
            `&fields=key,title,author_name,cover_i,first_publish_year,subject,isbn,number_of_pages_median`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Book search failed with status ${response.status}`);
        }

        const data = await response.json();

        displayBooks(data.docs || []);
    } catch (error) {
        console.error("Search error:", error);
        showError(
            "We could not load the books right now. Please try again."
        );
    } finally {
        setLoadingState(false);
    }
}

function displayBooks(books) {
    bookResults.innerHTML = "";

    if (books.length === 0) {
        emptyMessage.hidden = false;
        emptyMessage.textContent =
            "No books were found. Try a different search.";
        resultsCount.textContent = "0 books";
        return;
    }

    emptyMessage.hidden = true;
    resultsCount.textContent =
        `${books.length} ${books.length === 1 ? "book" : "books"}`;

    books.forEach((book) => {
        const card = createBookCard(book, false);
        bookResults.appendChild(card);
    });
}

function createBookCard(book, isReadingListCard = false) {
    const card = document.createElement("article");
    card.className = "book-card";

    const cover = document.createElement("img");
    cover.className = "book-cover";

    if (book.cover_i) {
        cover.src =
            `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`;
    } else {
        cover.src =
            "https://via.placeholder.com/300x450?text=No+Cover";
    }

    cover.alt = `Cover of ${book.title || "book"}`;
    cover.loading = "lazy";

    const content = document.createElement("div");
    content.className = "book-card-content";

    const title = document.createElement("h3");
    title.textContent = book.title || "Untitled";

    const author = document.createElement("p");
    author.className = "book-author";
    author.textContent =
        book.author_name?.join(", ") || "Unknown author";

    const year = document.createElement("p");
    year.className = "book-author";
    year.textContent = book.first_publish_year
        ? `First published: ${book.first_publish_year}`
        : "Publication year unavailable";

    content.append(title, author, year);

    if (isReadingListCard) {
        const tracking = createReadingProgressControls(book);
        content.appendChild(tracking);
    }

    const actions = document.createElement("div");
    actions.className = "book-actions";

    const detailsButton = document.createElement("button");
    detailsButton.className = "secondary-button";
    detailsButton.type = "button";
    detailsButton.textContent = "Details";

    const saveButton = document.createElement("button");
    saveButton.className = "primary-button";
    saveButton.type = "button";

    if (isReadingListCard) {
        saveButton.textContent = "Remove from List";
    } else {
        saveButton.textContent = isInReadingList(book.key)
            ? "Saved"
            : "Add to List";
    }

    detailsButton.addEventListener("click", () => {
        showBookDetails(book);
    });

    saveButton.addEventListener("click", () => {
        toggleReadingList(book);
    });

    actions.append(detailsButton, saveButton);

    content.appendChild(actions);
    card.append(cover, content);

    return card;
}

function createReadingProgressControls(book) {
    const savedBook = readingList.find(
        (item) => item.key === book.key
    );

    const currentStatus =
        savedBook?.readingStatus || "Want to Read";

    const currentProgress =
        Number.isFinite(Number(savedBook?.progress))
            ? Number(savedBook.progress)
            : 0;

    const tracking = document.createElement("div");
    tracking.className = "reading-progress";

    const statusLabel = document.createElement("label");
    statusLabel.textContent = "Reading status";
    statusLabel.htmlFor = `status-${sanitizeKey(book.key)}`;

    const statusSelect = document.createElement("select");
    statusSelect.id = `status-${sanitizeKey(book.key)}`;
    statusSelect.className = "status-select";

    const statuses = [
        "Want to Read",
        "Reading",
        "Completed",
    ];

    statuses.forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;

        if (status === currentStatus) {
            option.selected = true;
        }

        statusSelect.appendChild(option);
    });

    const progressLabel = document.createElement("label");
    progressLabel.htmlFor = `progress-${sanitizeKey(book.key)}`;
    progressLabel.textContent = `Reading progress: ${currentProgress}%`;

    const progressRange = document.createElement("input");
    progressRange.type = "range";
    progressRange.id = `progress-${sanitizeKey(book.key)}`;
    progressRange.className = "progress-range";
    progressRange.min = "0";
    progressRange.max = "100";
    progressRange.step = "5";
    progressRange.value = String(currentProgress);

    statusSelect.addEventListener("change", () => {
        updateBookTracking(book.key, {
            readingStatus: statusSelect.value,
        });

        if (statusSelect.value === "Completed") {
            progressRange.value = "100";
            progressLabel.textContent = "Reading progress: 100%";

            updateBookTracking(book.key, {
                progress: 100,
            });
        }

        saveReadingList();
    });

    progressRange.addEventListener("input", () => {
        progressLabel.textContent =
            `Reading progress: ${progressRange.value}%`;
    });

    progressRange.addEventListener("change", () => {
        updateBookTracking(book.key, {
            progress: Number(progressRange.value),
        });

        saveReadingList();
    });

    tracking.append(
        statusLabel,
        statusSelect,
        progressLabel,
        progressRange
    );

    return tracking;
}

function updateBookTracking(bookKey, changes) {
    const book = readingList.find(
        (item) => item.key === bookKey
    );

    if (!book) {
        return;
    }

    Object.assign(book, changes);
}

function sanitizeKey(key) {
    return key.replace(/[^a-zA-Z0-9-_]/g, "-");
}

function toggleReadingList(book) {
    const existingIndex = readingList.findIndex(
        (item) => item.key === book.key
    );

    if (existingIndex >= 0) {
        readingList.splice(existingIndex, 1);
    } else {
        readingList.push({
            ...book,
            readingStatus: "Want to Read",
            progress: 0,
        });
    }

    saveReadingList();
    displayReadingList();
}

function displayReadingList() {
    readingListBooks.innerHTML = "";

    readingListCount.textContent =
        `${readingList.length} ${readingList.length === 1 ? "book" : "books"
        }`;

    if (readingList.length === 0) {
        readingListEmpty.hidden = false;
        return;
    }

    readingListEmpty.hidden = true;

    readingList.forEach((book) => {
        readingListBooks.appendChild(
            createBookCard(book, true)
        );
    });
}

function isInReadingList(bookKey) {
    return readingList.some(
        (book) => book.key === bookKey
    );
}

async function showBookDetails(book) {
    const title = book.title || "Untitled";
    const authors = book.author_name?.join(", ") || "Unknown author";
    const year = book.first_publish_year || "Unavailable";
    const pages = book.number_of_pages_median || "Unavailable";

    const subjects =
        book.subject?.slice(0, 5).join(", ") ||
        "No subject information available.";

    let gutenbergInfo =
        "No matching Project Gutenberg edition was found.";

    try {
        const url = `${GUTENDEX_API}?search=${encodeURIComponent(title)}`;
        const response = await fetch(url);

        if (response.ok) {
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                const gutenbergBook = data.results[0];

                gutenbergInfo =
                    `Project Gutenberg edition found: ` +
                    `${gutenbergBook.title || title}`;

                if (gutenbergBook.formats?.["text/html"]) {
                    gutenbergInfo +=
                        `\nRead online: ${gutenbergBook.formats["text/html"]}`;
                }
            }
        }
    } catch (error) {
        console.error("Gutendex lookup failed:", error);
    }

    alert(
        `${title}\n\n` +
        `Author: ${authors}\n` +
        `First published: ${year}\n` +
        `Pages: ${pages}\n` +
        `Subjects: ${subjects}\n\n` +
        `--- Project Gutenberg ---\n` +
        `${gutenbergInfo}`
    );
}

function setLoadingState(isLoading) {
    loadingMessage.hidden = !isLoading;
    searchButton.disabled = isLoading;

    if (isLoading) {
        searchButton.textContent = "Searching...";
    } else {
        searchButton.textContent = "Search";
    }
}

function clearMessages() {
    errorMessage.hidden = true;
    errorMessage.textContent = "";
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
}

displayReadingList();