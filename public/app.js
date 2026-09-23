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
       Folder list
       ----------------------------------------------------- */

    const folders = [
        ...new Set(
            files.map(
                (file) => file.folder || "General"
            )
        )
    ].sort();


    /* -----------------------------------------------------
       Folder filter dropdown
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
       Statistics
       ----------------------------------------------------- */

    $("fileCount").textContent = files.length;

    $("folderCount").textContent = folders.length;

    $("totalSize").textContent = fmt(
        files.reduce(
            (total, file) => total + file.size,
            0
        )
    );


    /* -----------------------------------------------------
       Group files by folder
       ----------------------------------------------------- */

    const grouped = {};

    filteredFiles.forEach((file) => {
        const folder = file.folder || "General";

        if (!grouped[folder]) {
            grouped[folder] = [];
        }

        grouped[folder].push(file);
    });


    /* -----------------------------------------------------
       Render folders
       ----------------------------------------------------- */

    if (!Object.keys(grouped).length) {
        $("folders").innerHTML = `
            <div class="empty">
                <h3>No resources found</h3>
                <p>
                    Try another search or folder.
                </p>
            </div>
        `;

        return;
    }


    $("folders").innerHTML =
        Object.entries(grouped)
            .map(([folder, list]) => {

                return `
                    <article class="folder">

                        <div class="folderTitle">

                            <span class="folderIcon">
                                📁
                            </span>

                            <div>

                                <h3>
                                    ${esc(folder)}
                                </h3>

                                <span class="count">
                                    ${list.length}
                                    file${list.length !== 1 ? "s" : ""}
                                </span>

                            </div>

                        </div>


                        ${list
                            .map(
                                (file) => `
                                    <div class="file">

                                        <a
                                            href="/api/download/${encodeURIComponent(file.id)}"
                                            title="${esc(file.name)}"
                                        >
                                            📄 ${esc(file.name)}
                                        </a>

                                        <span class="download">
                                            ↓ ${fmt(file.size)}
                                        </span>

                                    </div>
                                `
                            )
                            .join("")}

                    </article>
                `;
            })
            .join("");
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

async function adminList() {
    $("adminFiles").innerHTML =
        files
            .map(
                (file) => `
                    <div class="adminItem">

                        <span>
                            ${esc(file.folder)}
                            /
                            ${esc(file.name)}
                        </span>

                        <button
                            class="danger"
                            onclick="del('${file.id}')"
                        >
                            Delete
                        </button>

                    </div>
                `
            )
            .join("") ||
        "<p>No files yet.</p>";
}


/* =========================================================
   12. DELETE FILE
   ========================================================= */

async function del(id) {
    if (!confirm("Delete this file?")) {
        return;
    }


    const response = await fetch(
        "/api/files/" + encodeURIComponent(id),
        {
            method: "DELETE",

            headers: {
                "x-admin-token": token
            }
        }
    );


    if (response.ok) {
        await load();

        adminList();

        toast("File deleted");
    }
}


/* =========================================================
   13. TOAST NOTIFICATION
   ========================================================= */

function toast(message) {
    $("toast").textContent = message;

    $("toast").style.display = "block";


    setTimeout(() => {
        $("toast").style.display = "none";
    }, 2200);
}


/* =========================================================
   14. INITIALIZE WEBSITE
   ========================================================= */

initTheme();

load();
