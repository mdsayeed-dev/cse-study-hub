/* =========================================================
   CSE STUDY HUB 2.0
   Main JavaScript
   ========================================================= */


/* =========================================================
   1. GLOBAL VARIABLES
   ========================================================= */

let files = [];
let token = sessionStorage.getItem("adminToken") || "";

const $ = (id) => document.getElementById(id);


/* =========================================================
   2. THEME — DARK / LIGHT MODE
   ========================================================= */

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);

    const button = $("themeToggle");

    if (!button) return;

    if (theme === "dark") {
        button.textContent = "☀️";
        button.setAttribute(
            "aria-label",
            "Switch to light mode"
        );
        button.setAttribute(
            "title",
            "Switch to light mode"
        );
    } else {
        button.textContent = "🌙";
        button.setAttribute(
            "aria-label",
            "Switch to dark mode"
        );
        button.setAttribute(
            "title",
            "Switch to dark mode"
        );
    }
}

function initTheme() {
    const savedTheme =
        localStorage.getItem("theme") || "light";

    applyTheme(savedTheme);
}

$("themeToggle").onclick = () => {
    const currentTheme =
        document.documentElement.getAttribute("data-theme") ||
        "light";

    const nextTheme =
        currentTheme === "dark"
            ? "light"
            : "dark";

    localStorage.setItem("theme", nextTheme);

    applyTheme(nextTheme);
};


/* =========================================================
   3. UTILITY FUNCTIONS
   ========================================================= */

function esc(value) {
    return String(value).replace(
        /[&<>"']/g,
        (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]
    );
}

function fmt(bytes) {
    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1048576) {
        return (bytes / 1024).toFixed(1) + " KB";
    }

    return (bytes / 1048576).toFixed(1) + " MB";
}


/* =========================================================
   4. LOAD FILES
   ========================================================= */

async function load() {
    const response = await fetch("/api/files");

    files = await response.json();

    render();
}


/* =========================================================
   5. RENDER FILES & FOLDERS
   ========================================================= */

function render() {

    const query = $("search").value.toLowerCase();
    const selectedFolder = $("folderFilter").value;

    const filteredFiles = files.filter((file) => {

        const matchesSearch =
            !query ||
            `${file.name} ${file.folder}`
                .toLowerCase()
                .includes(query);

        const matchesFolder =
            !selectedFolder ||
            file.folder === selectedFolder;

        return matchesSearch && matchesFolder;
    });


    /* -----------------------------------------------------
       Statistics
       ----------------------------------------------------- */

    const folders = [
        ...new Set(
            files.map(
                (file) => file.folder || "General"
            )
        )
    ].sort();

    $("fileCount").textContent =
        files.length;

    $("folderCount").textContent =
        folders.length;

    $("totalSize").textContent =
        fmt(
            files.reduce(
                (total, file) =>
                    total + file.size,
                0
            )
        );


    /* -----------------------------------------------------
       Folder filter
       ----------------------------------------------------- */

    $("folderFilter").innerHTML =
        '<option value="">All folders</option>' +
        folders
            .map(
                (folder) => `
                    <option
                        ${folder === selectedFolder ? "selected" : ""}
                        value="${esc(folder)}"
                    >
                        ${esc(folder)}
                    </option>
                `
            )
            .join("");


    /* -----------------------------------------------------
       Explorer state
       ----------------------------------------------------- */

    if (!window.explorerPath) {
        window.explorerPath = [];
    }


    /* -----------------------------------------------------
       Build folder tree
       ----------------------------------------------------- */

    const tree = {};


    filteredFiles.forEach((file) => {

        const folderPath =
            file.folder || "General";

        const parts =
            folderPath
                .split("/")
                .filter(Boolean);

        let current = tree;

        parts.forEach((part) => {

            if (!current[part]) {
                current[part] = {
                    folders: {},
                    files: []
                };
            }

            current =
                current[part].folders;
        });

    });


    /* -----------------------------------------------------
       Current explorer path
       ----------------------------------------------------- */

    const currentPath =
        window.explorerPath.join("/");


    let currentNode = tree;


    if (window.explorerPath.length) {

        for (
            const part of window.explorerPath
        ) {

            if (
                currentNode[part] &&
                currentNode[part].folders
            ) {
                currentNode =
                    currentNode[part].folders;
            }

        }

    }


    /* -----------------------------------------------------
       Find files inside current folder
       ----------------------------------------------------- */

    const visibleFiles =
        filteredFiles.filter((file) => {

            const folder =
                file.folder || "General";

            return folder === currentPath;

        });


    /* -----------------------------------------------------
       Breadcrumb
       ----------------------------------------------------- */

    let html = `

        <div class="explorerHeader">

            ${
                window.explorerPath.length
                    ? `
                        <button
                            class="ghost"
                            type="button"
                            onclick="goBackExplorer()"
                        >
                            ← Back
                        </button>
                    `
                    : ""
            }

            <div class="breadcrumb">

                <button
                    type="button"
                    onclick="goHomeExplorer()"
                >
                    🏠 CSE Study Hub
                </button>

                ${
                    window.explorerPath
                        .map(
                            (part, index) => {

                                const path =
                                    window.explorerPath
                                        .slice(
                                            0,
                                            index + 1
                                        )
                                        .join("/");

                                return `
                                    <span>
                                        /
                                    </span>

                                    <button
                                        type="button"
                                        onclick="openExplorerFolder(
                                            '${encodeURIComponent(path).replace(/'/g, "%27")}'
                                        )"
                                    >
                                        ${esc(part)}
                                    </button>
                                `;

                            }
                        )
                        .join("")

                }

            </div>

        </div>

    `;


    /* -----------------------------------------------------
       Empty state
       ----------------------------------------------------- */

    if (
        !Object.keys(currentNode).length &&
        !visibleFiles.length
    ) {

        $("folders").innerHTML =
            html +
            `
                <div class="empty">

                    <h3>
                        No resources found
                    </h3>

                    <p>
                        Try another search or folder.
                    </p>

                </div>
            `;

        return;
    }


    /* -----------------------------------------------------
       Render folders
       ----------------------------------------------------- */

    Object.entries(currentNode)
        .forEach(([folderName, node]) => {

            const fullPath =
                [
                    ...window.explorerPath,
                    folderName
                ].join("/");

            html += `

                <article
                    class="folder explorerFolder"
                    onclick="openExplorerFolder(
                        '${encodeURIComponent(fullPath).replace(/'/g, "%27")}'
                    )"
                >

                    <div class="folderTitle">

                        <span class="folderIcon">
                            📁
                        </span>

                        <div>

                            <h3>
                                ${esc(folderName)}
                            </h3>

                            <span class="count">
                                Open folder
                            </span>

                        </div>

                    </div>

                </article>

            `;

        });


    /* -----------------------------------------------------
       Render files
       ----------------------------------------------------- */

    visibleFiles.forEach((file) => {

        html += `

            <article class="folder">

                <div class="folderTitle">

                    <span class="folderIcon">
                        📄
                    </span>

                    <div>

                        <h3>
                            ${esc(file.name)}
                        </h3>

                        <span class="count">
                            ${fmt(file.size)}
                        </span>

                    </div>

                </div>


                <div class="file">

                    <a
                        href="/api/download/${encodeURIComponent(file.id)}"
                        title="${esc(file.name)}"
                    >
                        Download
                    </a>

                    <span class="download">
                        ↓ ${fmt(file.size)}
                    </span>

                </div>

            </article>

        `;

    });


    $("folders").innerHTML =
        html;


    /* -----------------------------------------------------
       Explorer navigation functions
       ----------------------------------------------------- */

    window.openExplorerFolder =
        function (encodedPath) {

            const path =
                decodeURIComponent(encodedPath);

            window.explorerPath =
                path
                    .split("/")
                    .filter(Boolean);

            render();

        };


    window.goHomeExplorer =
        function () {

            window.explorerPath = [];

            render();

        };


    window.goBackExplorer =
        function () {

            window.explorerPath =
                window.explorerPath.slice(
                    0,
                    -1
                );

            render();

        };

}

/* =========================================================
   6. SEARCH & FOLDER FILTER
   ========================================================= */

$("search").oninput = render;

$("folderFilter").onchange = render;


/* =========================================================
   7. ADMIN MODAL
   ========================================================= */

$("adminBtn").onclick = () => {
    $("modal").classList.remove("hidden");

    if (token) {
        panel();
    }
};

function closeModal() {
    $("modal").classList.add("hidden");
}


/* =========================================================
   8. ADMIN LOGIN
   ========================================================= */

async function login() {
    const response = await fetch(
        "/api/login",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                password: $("password").value
            })
        }
    );


    if (!response.ok) {
        $("loginError").textContent =
            "Wrong password.";

        return;
    }


    const data = await response.json();

    token = data.token;

    sessionStorage.setItem(
        "adminToken",
        token
    );

    panel();
}


/* =========================================================
   9. ADMIN PANEL
   ========================================================= */

async function panel() {
    $("loginView").classList.add("hidden");

    $("panelView").classList.remove("hidden");

    adminList();
}


/* =========================================================
   10. FILE UPLOAD
   ========================================================= */

async function uploadFiles() {

    const individualFiles = [
        ...$("files").files
    ];

    const folderFiles = [
        ...$("folderFiles").files
    ];

    const selectedFiles = [
        ...individualFiles,
        ...folderFiles
    ];


    if (!selectedFiles.length) {

        $("uploadStatus").textContent =
            "Select files or a folder first.";

        return;
    }


    const form = new FormData();


    /* Folder label */

    const department = $("departmentName").value.trim();
const category = $("categoryName").value.trim();
const semester = $("semesterName").value.trim();
const subject = $("subjectName").value.trim();

const folderPath = [
    department,
    category,
    semester,
    subject
]
    .filter(Boolean)
    .join("/");

form.append(
    "folder",
    folderPath
);


    /* Selected files */

    selectedFiles.forEach((file) => {

        form.append(
            "files",
            file,
            file.webkitRelativePath || file.name
        );

    });


    /* Upload status */

    $("uploadStatus").textContent =
        "Uploading...";

    $("progress").classList.remove("hidden");

    $("progress").firstElementChild.style.width =
        "30%";


    /* Send upload request */

    const response = await fetch(
        "/api/upload",
        {
            method: "POST",

            headers: {
                "x-admin-token": token
            },

            body: form
        }
    );


    const data = await response.json();


    /* Upload failed */

    if (!response.ok) {

        $("uploadStatus").textContent =
            data.error || "Upload failed.";

        return;
    }


    /* Upload successful */

    $("progress").firstElementChild.style.width =
        "100%";

    $("uploadStatus").textContent =
        `Uploaded ${data.added} file(s) successfully.`;


    /* Clear both inputs */

    $("files").value = "";

    $("folderFiles").value = "";


    await load();

    adminList();

    toast("Upload complete");
}

/* =========================================================
   11. ADMIN FILE LIST
   ========================================================= */

/* =========================================================
   11. ADMIN FILE MANAGEMENT
   ========================================================= */

/* =========================================================
   ADMIN FILE MANAGEMENT
   ========================================================= */

async function adminList() {

    const container = $("adminFiles");

    if (!container) {
        return;
    }

    if (!files.length) {
        container.innerHTML = "<p>No files yet.</p>";
        return;
    }

    container.innerHTML = `
        <div class="csh-admin-toolbar">

            <label class="csh-select-all">

                <input
                    type="checkbox"
                    id="cshSelectAll"
                    onchange="toggleSelectAll()"
                >

                <span>Select All</span>

            </label>

            <div
                id="cshSelectedCount"
                class="csh-selected-count"
            >
                0 files selected
            </div>

            <button
                type="button"
                id="cshDeleteSelected"
                class="danger"
                onclick="deleteSelected()"
                disabled
            >
                Delete Selected
            </button>

        </div>

        <div class="csh-admin-file-list">

            ${files.map((file) => `

                <div
                    class="csh-admin-file"
                    data-file-id="${esc(file.id)}"
                >

                    <label class="csh-file-selector">

                        <input
                            type="checkbox"
                            class="csh-file-checkbox"
                            value="${esc(file.id)}"
                            onchange="updateSelectedCount()"
                        >

                        <div class="csh-file-name">
                            ${esc(file.folder)} / ${esc(file.name)}
                        </div>

                    </label>

                    <button
                        type="button"
                        class="danger csh-single-delete"
                        onclick="del('${esc(file.id)}')"
                    >
                        Delete
                    </button>

                </div>

            `).join("")}

        </div>
    `;

    updateSelectedCount();
}


/* =========================================================
   SELECT ALL
   ========================================================= */

function toggleSelectAll() {

    const selectAll =
        document.getElementById("cshSelectAll");

    const checkboxes =
        document.querySelectorAll(
            ".csh-file-checkbox"
        );

    checkboxes.forEach((checkbox) => {
        checkbox.checked = selectAll.checked;
    });

    updateSelectedCount();
}


/* =========================================================
   SELECTED COUNT
   ========================================================= */

function updateSelectedCount() {

    const selected =
        document.querySelectorAll(
            ".csh-file-checkbox:checked"
        ).length;

    const total =
        document.querySelectorAll(
            ".csh-file-checkbox"
        ).length;

    const count =
        document.getElementById(
            "cshSelectedCount"
        );

    if (count) {
        count.textContent =
            `${selected} file${selected === 1 ? "" : "s"} selected`;
    }

    const deleteButton =
        document.getElementById(
            "cshDeleteSelected"
        );

    if (deleteButton) {
        deleteButton.disabled =
            selected === 0;
    }

    const selectAll =
        document.getElementById(
            "cshSelectAll"
        );

    if (selectAll) {
        selectAll.checked =
            total > 0 &&
            selected === total;
    }
}


/* =========================================================
   DELETE SELECTED
   ========================================================= */

async function deleteSelected() {

    const selected =
        [
            ...document.querySelectorAll(
                ".csh-file-checkbox:checked"
            )
        ].map(
            checkbox => checkbox.value
        );

    if (!selected.length) {
        toast("No files selected.");
        return;
    }

    const confirmed =
        confirm(
            `Are you sure you want to delete these ${selected.length} files?`
        );

    if (!confirmed) {
        return;
    }

    const button =
        document.getElementById(
            "cshDeleteSelected"
        );

    if (button) {
        button.disabled = true;
        button.textContent = "Deleting...";
    }

    try {

        const response =
            await fetch(
                "/api/files/bulk-delete",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "x-admin-token":
                            token
                    },

                    body: JSON.stringify({
                        ids: selected
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Bulk delete failed."
            );
        }

        await load();

        adminList();

        toast(
            `${data.deleted} file${data.deleted === 1 ? "" : "s"} deleted successfully.`
        );

    } catch (error) {

        console.error(
            "BULK DELETE ERROR:",
            error
        );

        toast(
            error.message ||
            "Bulk delete failed."
        );

        adminList();
    }
}


/* =========================================================
   DELETE SINGLE FILE
   ========================================================= */

async function del(id) {

    if (!confirm("Delete this file?")) {
        return;
    }

    try {

        const response =
            await fetch(
                "/api/files/" +
                encodeURIComponent(id),
                {
                    method: "DELETE",

                    headers: {
                        "x-admin-token":
                            token
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Delete failed."
            );
        }

        await load();

        adminList();

        toast(
            "File deleted successfully."
        );

    } catch (error) {

        console.error(
            "DELETE ERROR:",
            error
        );

        toast(
            error.message ||
            "Delete failed."
        );
    }
}

/* =========================================================
   16. TOAST NOTIFICATION
   ========================================================= */

function toast(message) {

    $("toast").textContent =
        message;

    $("toast").style.display =
        "block";


    setTimeout(() => {

        $("toast").style.display =
            "none";

    }, 2200);
}


/* =========================================================
   17. INITIALIZE WEBSITE
   ========================================================= */

initTheme();

load();
