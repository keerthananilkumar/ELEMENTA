
/* =====================================================
   ELEMENTA × KIANA
   MAIN APPLICATION ENGINE
   Compact Discovery + Holographic Controls
   ===================================================== */


/* =====================================================
   1. DOM ELEMENTS
   ===================================================== */

const elementGrid = document.getElementById("periodic-grid");
const rareGrid = document.getElementById("rare-elements-grid");

const kianaGrid = document.getElementById("kiana-element-grid");
const kianaSearch = document.getElementById("kiana-search");
const kianaCategoryFilter = document.getElementById("kiana-category-filter");
const kianaResultCount = document.getElementById("kiana-result-count");

const detailsPanel = document.getElementById("element-details");

const kianaWorkspace = document.querySelector(".kiana-workspace");
const kianaProfile = document.getElementById("kiana-profile-view");

const webcam = document.getElementById("webcam");
const cameraOverlay = document.getElementById("camera-overlay");

const startCameraButton = document.getElementById("start-camera");
const stopCameraButton = document.getElementById("stop-camera");

const cameraStatus = document.getElementById("camera-status");
const visionStatus = document.getElementById("kiana-vision-status");

const gestureReadout = document.getElementById("gesture-readout");
const pinchStatus = document.getElementById("pinch-status");

const gestureInterface = document.getElementById("gesture-control");

let cameraStream = null;
let selectedElement = null;

let kianaActive = false;
let cameraStarting = false;
let kianaInputLocked = false;


/* =====================================================
   2. CATEGORY NORMALIZATION
   ===================================================== */

function normalizeCategory(category) {

    const value = String(category || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]/g, " ");

    const aliases = {
        "alkali metal": "alkali metal",
        "alkaline earth metal": "alkaline earth metal",
        "transition metal": "transition metal",
        "post transition metal": "post-transition metal",
        "post-transition metal": "post-transition metal",
        "metalloid": "metalloid",
        "nonmetal": "nonmetal",
        "non metal": "nonmetal",
        "halogen": "halogen",
        "noble gas": "noble gas",
        "lanthanide": "lanthanide",
        "actinide": "actinide"
    };

    return aliases[value] || value;
}


function categoryClass(category) {

    return normalizeCategory(category).replace(/\s+/g, "-");

}


/* =====================================================
   3. ELEMENT LOOKUP
   ===================================================== */

function getRareElement(elementNumber) {

    return rareElements.find(item =>
        Number(item.number) === Number(elementNumber)
    );

}


function getElementByNumber(number) {

    return elements.find(element =>
        Number(element.number) === Number(number)
    );

}


/* =====================================================
   4. SAFE HTML HELPERS
   ===================================================== */

function escapeElementHTML(value) {

    return String(value ?? "--").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);

}


function setText(id, value) {

    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }

}

/* =====================================================
   5. KIANA TRANSPARENT DISCOVERY INTERFACE
   ===================================================== */

function installKianaDiscoveryInterface() {

    if (!kianaCategoryFilter || !kianaGrid) return;

    const searchArea = document.querySelector(".kiana-search-area");
    const toolbar = document.querySelector(".kiana-discovery-toolbar");

    // Completely remove search interface.
    if (searchArea) {
        searchArea.remove();
    }

    if (!toolbar) return;

    // Hide the original category dropdown.
    kianaCategoryFilter.style.display = "none";

    // Transparent holographic styling.
    if (!document.getElementById("kiana-discovery-enhancements")) {

        const style = document.createElement("style");

        style.id = "kiana-discovery-enhancements";

        style.textContent = `
            .kiana-floating-filter {
                position: relative;
                width: 100%;
                max-height: 300px;
                overflow-y: auto;
                padding: 12px;
                margin-top: 12px;
                border: 1px solid rgba(90, 220, 255, .3);
                border-radius: 14px;
                background: rgba(5, 20, 35, .12);
                backdrop-filter: blur(8px);
                box-shadow: 0 0 25px rgba(0, 180, 255, .08);
            }

            .kiana-floating-filter[hidden] {
                display: none !important;
            }

            .kiana-filter-trigger {
                width: 43px;
                height: 43px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 1px solid rgba(90, 220, 255, .4);
                border-radius: 12px;
                background: rgba(20, 120, 180, .08);
                color: #9beaff;
                font-size: 21px;
                cursor: pointer;
                backdrop-filter: blur(6px);
            }

            .kiana-filter-title {
                color: #9beaff;
                font-size: 11px;
                letter-spacing: 2px;
                margin-bottom: 10px;
            }

            .kiana-filter-options {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 7px;
            }

            .kiana-filter-option {
                border: 1px solid rgba(90, 220, 255, .22);
                border-radius: 8px;
                background: rgba(30, 110, 160, .07);
                color: #d8f7ff;
                padding: 9px 7px;
                font-size: 11px;
                cursor: pointer;
                backdrop-filter: blur(5px);
            }

            .kiana-filter-option.active {
                border-color: #65e7ff;
                background: rgba(30, 190, 240, .16);
                color: #ffffff;
                box-shadow: 0 0 12px rgba(60, 210, 255, .16);
            }

            .kiana-filter-trigger:focus-visible,
            .kiana-filter-option:focus-visible {
                outline: 2px solid #8ceeff;
                outline-offset: 2px;
            }

            .kiana-discovery-toolbar {
                margin-top: 8px;
                margin-bottom: 10px;
            }

            .kiana-discovery-toolbar .kiana-filter {
                display: none;
            }
        `;

        document.head.appendChild(style);
    }

    // Create the filter trigger.
    let filterButton = document.getElementById("kiana-filter-trigger");

    if (!filterButton) {

        filterButton = document.createElement("button");

        filterButton.type = "button";
        filterButton.id = "kiana-filter-trigger";
        filterButton.className = "kiana-filter-trigger";
        filterButton.textContent = "☷";
        filterButton.setAttribute("aria-label", "Open category filter");

        toolbar.appendChild(filterButton);
    }

    // Create the transparent category panel.
    let filterPanel = document.getElementById("kiana-floating-filter");

    if (!filterPanel) {

        filterPanel = document.createElement("div");

        filterPanel.id = "kiana-floating-filter";
        filterPanel.className = "kiana-floating-filter";
        filterPanel.hidden = true;

        filterPanel.innerHTML = `
            <div class="kiana-filter-title">
                SELECT ELEMENT FAMILY
            </div>
            <div class="kiana-filter-options"></div>
        `;

        toolbar.appendChild(filterPanel);
    }

    const filterOptions = filterPanel.querySelector(".kiana-filter-options");

    filterOptions.innerHTML = "";

    Array.from(kianaCategoryFilter.options).forEach(option => {

        const button = document.createElement("button");

        button.type = "button";
        button.className = "kiana-filter-option";
        button.dataset.category = option.value;
        button.textContent = option.textContent;

        button.addEventListener("click", () => {

            kianaCategoryFilter.value = option.value;

            updateKianaDiscovery();

            filterPanel.hidden = true;

        });

        filterOptions.appendChild(button);

    });

    filterButton.addEventListener("click", () => {

        filterPanel.hidden = !filterPanel.hidden;

    });

    updateKianaFilterSelection();

}


function updateKianaFilterSelection() {

    const current = kianaCategoryFilter?.value || "all";

    document.querySelectorAll(".kiana-filter-option").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.category === current
        );

    });

}
/* =====================================================
   6. NORMAL PERIODIC TABLE
   ===================================================== */

function displayElements() {

    if (!elementGrid) return;

    elementGrid.innerHTML = "";

    elements.forEach(element => {

        const card = document.createElement("button");

        card.type = "button";
        card.className = `element-card ${categoryClass(element.category)}`;
        card.dataset.number = element.number;

        card.setAttribute(
            "aria-label",
            `${element.name}, atomic number ${element.number}`
        );

        const number = document.createElement("span");
        number.className = "element-number";
        number.textContent = element.number;

        const symbol = document.createElement("span");
        symbol.className = "element-symbol";
        symbol.textContent = element.symbol;

        const name = document.createElement("span");
        name.className = "element-name";
        name.textContent = element.name;

        const mass = document.createElement("span");
        mass.className = "element-mass";
        mass.textContent = element.mass;

        card.append(number, symbol, name, mass);

        const atomicNumber = Number(element.number);

        if (atomicNumber >= 58 && atomicNumber <= 71) {

            card.style.gridColumn = atomicNumber - 55;
            card.style.gridRow = 9;

        } else if (atomicNumber >= 90 && atomicNumber <= 103) {

            card.style.gridColumn = atomicNumber - 87;
            card.style.gridRow = 10;

        } else {

            card.style.gridColumn = element.group;
            card.style.gridRow = element.period;

        }

        card.addEventListener("click", () => showElementDetails(element));

        elementGrid.appendChild(card);

    });

}


/* =====================================================
   7. ELECTRON SHELL CALCULATION
   ===================================================== */

function getElectronShells(atomicNumber) {

    const orbitals = [
        [1, 2], [2, 2], [2, 6], [3, 2], [3, 6],
        [4, 2], [3, 10], [4, 6], [5, 2], [4, 10],
        [5, 6], [6, 2], [4, 14], [5, 10], [6, 6],
        [7, 2], [5, 14], [6, 10], [7, 6]
    ];

    const shells = [0, 0, 0, 0, 0, 0, 0];

    let remaining = Math.max(0, Math.min(118, Number(atomicNumber)));

    for (const [shell, capacity] of orbitals) {

        if (remaining <= 0) break;

        const filled = Math.min(remaining, capacity);

        shells[shell - 1] += filled;
        remaining -= filled;

    }

    return shells.filter(count => count > 0);

}


/* =====================================================
   8. ATOMIC ANIMATION
   ===================================================== */

function createAtomicAnimation(atomicNumber, symbol) {

    const shells = getElectronShells(atomicNumber);

    const center = 150;
    const nucleusRadius = 25;
    const firstOrbit = 48;
    const orbitSpacing = 29;

    let orbitMarkup = "";

    shells.forEach((electronCount, shellIndex) => {

        const radius = firstOrbit + shellIndex * orbitSpacing;
        const duration = 5 + shellIndex * 2.5;

        let electrons = "";

        for (let i = 0; i < electronCount; i++) {

            const angle = (360 / electronCount) * i;

            electrons += `
                <circle
                    cx="${center}"
                    cy="${center - radius}"
                    r="4.5"
                    class="atom-electron"
                    transform="rotate(${angle} ${center} ${center})"
                />
            `;

        }

        orbitMarkup += `
            <circle cx="${center}" cy="${center}" r="${radius}" class="atom-orbit"/>
            <g class="atom-electron-ring" style="--orbit-duration:${duration}s">
                ${electrons}
            </g>
        `;

    });

    return `
        <div class="element-atom-visual">
            <svg class="atomic-model" viewBox="0 0 300 300"
                role="img" aria-label="${escapeElementHTML(symbol)} atomic model">

                <defs>
                    <radialGradient id="atom-core-${atomicNumber}">
                        <stop offset="0%" stop-color="#ffffff"/>
                        <stop offset="45%" stop-color="#56dfff"/>
                        <stop offset="100%" stop-color="#087bff"/>
                    </radialGradient>

                    <filter id="atom-glow-${atomicNumber}">
                        <feGaussianBlur stdDeviation="4" result="blur"/>
                        <feMerge>
                            <feMergeNode in="blur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>

                ${orbitMarkup}

                <circle cx="${center}" cy="${center}" r="${nucleusRadius}"
                    class="atom-nucleus"
                    fill="url(#atom-core-${atomicNumber})"
                    filter="url(#atom-glow-${atomicNumber})"/>

                <text x="${center}" y="${center + 6}"
                    text-anchor="middle" class="atom-nucleus-symbol">
                    ${escapeElementHTML(symbol)}
                </text>
            </svg>

            <div class="atom-caption">
                <span>ATOMIC STRUCTURE</span>
                <strong>${atomicNumber} ELECTRONS</strong>
            </div>

            <div class="atom-shell-counts">
                ${shells.map((count, index) =>
                    `<span>Shell ${index + 1}: ${count}</span>`
                ).join("")}
            </div>
        </div>
    `;

}


/* =====================================================
   9. ELEMENT DETAILS
   ===================================================== */

function showElementDetails(element) {

    if (!detailsPanel || !element) return;

    selectedElement = element;

    const rare = getRareElement(element.number);
    const atomicNumber = Number(element.number);

    const category = escapeElementHTML(element.category);
    const name = escapeElementHTML(element.name);
    const symbol = escapeElementHTML(element.symbol);
    const description = escapeElementHTML(
        element.description || "No description available."
    );

    const mass = escapeElementHTML(element.mass ?? "--");
    const group = escapeElementHTML(element.group ?? "--");
    const period = escapeElementHTML(element.period ?? "--");

    detailsPanel.innerHTML = `
        <div class="element-detail-backdrop"></div>

        <section class="element-detail-content" role="dialog"
            aria-modal="true" aria-label="${name} element details">

            <button type="button" class="close-details"
                aria-label="Close element details">×</button>

            <div class="element-detail-heading">
                <span class="detail-number">ATOMIC NUMBER ${atomicNumber}</span>
                <span class="detail-category">${category}</span>
            </div>

            <div class="element-detail-main">

                <div class="element-detail-information">
                    <div class="detail-symbol">${symbol}</div>
                    <h2>${name}</h2>

                    <p class="detail-description">${description}</p>

                    <div class="detail-properties">
                        <div><span>Atomic Mass</span><strong>${mass}</strong></div>
                        <div><span>Group</span><strong>${group}</strong></div>
                        <div><span>Period</span><strong>${period}</strong></div>
                        <div><span>Atomic Number</span><strong>${atomicNumber}</strong></div>
                    </div>

                    ${rare ? `
                        <div class="detail-rare-note">
                            <strong>Rare Earth Element</strong>
                            <p>${escapeElementHTML(rare.abundance ?? "Abundance information unavailable.")}</p>
                        </div>
                    ` : ""}
                </div>

                <div class="element-detail-atom">
                    ${createAtomicAnimation(atomicNumber, element.symbol)}
                </div>

            </div>

            <div class="element-detail-footer">
                <span>ELEMENTA</span>
                <span>PERIODIC TABLE EXPLORER</span>
            </div>
        </section>
    `;

    detailsPanel.classList.add("active");
    detailsPanel.setAttribute("aria-hidden", "false");

    document.body.classList.add("element-details-open");

    detailsPanel.querySelector(".close-details")
        ?.addEventListener("click", closeElementDetails);

    detailsPanel.querySelector(".element-detail-backdrop")
        ?.addEventListener("click", closeElementDetails);

}


function closeElementDetails() {

    if (!detailsPanel) return;

    detailsPanel.classList.remove("active");
    detailsPanel.setAttribute("aria-hidden", "true");

    document.body.classList.remove("element-details-open");

    selectedElement = null;

}


/* =====================================================
   10. RARE ELEMENTS EXPLORER
   ===================================================== */

function displayRareElements() {

    if (!rareGrid) return;

    rareGrid.innerHTML = "";

    rareElements.forEach(element => {

        const card = document.createElement("button");

        card.type = "button";
        card.className = "rare-element-card";
        card.dataset.number = element.number;

        card.innerHTML = `
            <div class="rare-element-image">
                ${element.image ? `
                    <img src="${escapeElementHTML(element.image)}"
                        alt="${escapeElementHTML(element.name)}" loading="lazy">
                ` : `
                    <span>${escapeElementHTML(element.symbol)}</span>
                `}
            </div>

            <div class="rare-element-info">
                <span class="rare-element-number">${escapeElementHTML(element.number)}</span>
                <h3>${escapeElementHTML(element.symbol)}</h3>
                <p>${escapeElementHTML(element.name)}</p>
                <span class="rare-element-abundance">
                    ${escapeElementHTML(element.abundance ?? "Abundance unknown")}
                </span>
            </div>
        `;

        card.addEventListener("click", () => {

            const mainElement = getElementByNumber(element.number);

            if (mainElement) showElementDetails(mainElement);

        });

        rareGrid.appendChild(card);

    });

}


/* =====================================================
   11. KIANA ELEMENT DISCOVERY
   ===================================================== */

function displayKianaElements(searchTerm = "", category = "all") {

    if (!kianaGrid) return;

    const search = String(searchTerm).trim().toLowerCase();

    const filteredElements = elements.filter(element => {

        const matchesSearch =
            String(element.name).toLowerCase().includes(search) ||
            String(element.symbol).toLowerCase().includes(search) ||
            String(element.number).includes(search);

        const matchesCategory =
            category === "all" ||
            normalizeCategory(element.category) === normalizeCategory(category);

        return matchesSearch && matchesCategory;

    });

    kianaGrid.innerHTML = "";

    if (kianaResultCount) {
        kianaResultCount.textContent =
            `${filteredElements.length} ELEMENTS FOUND`;
    }

    if (filteredElements.length === 0) {

        const emptyMessage = document.createElement("div");

        emptyMessage.className = "kiana-loading";
        emptyMessage.innerHTML = `
            <p>NO ELEMENTS FOUND</p>
            <span>Try another search.</span>
        `;

        kianaGrid.appendChild(emptyMessage);

        return;

    }

    filteredElements.forEach(element => {

        const card = document.createElement("button");

        card.type = "button";
        card.className = `kiana-element-card ${categoryClass(element.category)}`;
        card.dataset.number = element.number;

        card.setAttribute("aria-label", `Explore ${element.name}`);

        const number = document.createElement("span");
        number.className = "kiana-card-number";
        number.textContent = element.number;

        const symbol = document.createElement("span");
        symbol.className = "kiana-card-symbol";
        symbol.textContent = element.symbol;

        const name = document.createElement("span");
        name.className = "kiana-card-name";
        name.textContent = element.name;

        const categoryLabel = document.createElement("span");
        categoryLabel.className = "kiana-card-category";
        categoryLabel.textContent = element.category;

        card.append(number, symbol, name, categoryLabel);

        card.addEventListener("click", () => openKianaElement(element));

        kianaGrid.appendChild(card);

    });

}

function updateKianaDiscovery() {

    displayKianaElements(
        "",
        kianaCategoryFilter?.value || "all"
    );

    updateKianaFilterSelection();

}

kianaCategoryFilter?.addEventListener("change", updateKianaDiscovery);


/* =====================================================
   12. KIANA ELEMENT PROFILE
   ===================================================== */

function openKianaElement(element) {

    if (!element || !kianaWorkspace || !kianaProfile) return;

    selectedElement = element;

    const rare = getRareElement(element.number);

    setText("kiana-profile-number", element.number);
    setText("kiana-profile-symbol", element.symbol);
    setText("kiana-profile-name", element.name);
    setText("kiana-profile-category", element.category);

    setText(
        "kiana-profile-description",
        element.description || "No description available."
    );

    setText("kiana-profile-mass", element.mass ?? "--");
    setText("kiana-profile-group", element.group ?? "--");
    setText("kiana-profile-period", element.period ?? "--");
    setText("kiana-profile-atomic-number", element.number);

    const profileImage = document.getElementById("kiana-profile-image");
    const placeholder = document.getElementById("kiana-profile-placeholder");

    if (profileImage && placeholder) {

        profileImage.onerror = () => {
            profileImage.style.display = "none";
            placeholder.style.display = "block";
        };

        if (rare?.image) {

            profileImage.src = rare.image;
            profileImage.alt = `${element.name} visual`;
            profileImage.style.display = "block";
            placeholder.style.display = "none";

        } else {

            profileImage.removeAttribute("src");
            profileImage.style.display = "none";
            placeholder.textContent = element.symbol;
            placeholder.style.display = "block";

        }

    }

    const rareDetails = document.getElementById("kiana-rare-details");

    if (rare && rareDetails) {

        rareDetails.hidden = false;

        setText("kiana-profile-abundance", rare.abundance ?? "--");
        setText("kiana-profile-availability", rare.availabilityNote ?? "--");
        setText("kiana-profile-sources", rare.sources ?? "--");
        setText("kiana-profile-use", rare.use ?? "--");
        setText("kiana-profile-countries", rare.countries ?? "--");

    } else if (rareDetails) {

        rareDetails.hidden = true;

    }

    // Create the KIANA profile close button once.
    let closeButton = kianaProfile.querySelector(".kiana-profile-close");

    if (!closeButton) {

        closeButton = document.createElement("button");

        closeButton.type = "button";
        closeButton.className = "kiana-profile-close";
        closeButton.id = "kiana-profile-close";
        closeButton.textContent = "×";
        closeButton.setAttribute("aria-label", "Close element profile");

        closeButton.addEventListener("click", closeKianaProfile);

        const profileContent = kianaProfile.querySelector(".kiana-profile-content");

        if (profileContent) {
            kianaProfile.insertBefore(closeButton, profileContent);
        } else {
            kianaProfile.prepend(closeButton);
        }

    }

    kianaWorkspace.hidden = true;
    kianaProfile.hidden = false;
    kianaProfile.scrollTop = 0;

    if (gestureReadout) {
        gestureReadout.textContent = `ELEMENT PROFILE OPEN · ${element.symbol}`;
    }

}


function closeKianaProfile() {

    if (kianaWorkspace) kianaWorkspace.hidden = false;
    if (kianaProfile) {
        kianaProfile.hidden = true;
        kianaProfile.scrollTop = 0;
    }

    selectedElement = null;

    if (gestureReadout) {
        gestureReadout.textContent = "RETURNED TO ELEMENT DISCOVERY";
    }

}


document.getElementById("kiana-profile-back")
    ?.addEventListener("click", closeKianaProfile);

/* =====================================================
   13. GESTURE-ONLY INPUT LOCK
   ===================================================== */

// These controls must remain physically clickable.
const kianaAllowedPhysicalControls = [
    "#start-camera",
    "#stop-camera",
    "#how-to-play",
    "#exit-gesture-mode"
].join(", ");

function lockKianaPhysicalInput() {

    if (kianaInputLocked || !gestureInterface) return;

    kianaInputLocked = true;

    gestureInterface.classList.add("kiana-gesture-locked");
}

function unlockKianaPhysicalInput() {

    kianaInputLocked = false;

    gestureInterface?.classList.remove("kiana-gesture-locked");
}

function blockPhysicalPointer(event) {

    if (!kianaInputLocked) return;

    if (!gestureInterface?.contains(event.target)) return;

    // Allow physical interaction with essential KIANA controls.
    const allowedControl = event.target?.closest?.(
        kianaAllowedPhysicalControls
    );

    if (allowedControl) return;

    // Allow synthetic clicks generated by gesture.js.
    if (event.type === "click" && !event.isTrusted) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}

[
    "pointerdown",
    "mousedown",
    "mouseup",
    "touchstart",
    "contextmenu",
    "wheel"
].forEach(eventName => {

    document.addEventListener(
        eventName,
        blockPhysicalPointer,
        { capture: true, passive: false }
    );

});

document.addEventListener("click", blockPhysicalPointer, true);

document.addEventListener("keydown", event => {

    if (!kianaInputLocked) return;

    const activeElement = document.activeElement;

    if (!gestureInterface?.contains(activeElement)) return;

    if (activeElement?.matches?.(kianaAllowedPhysicalControls)) return;

    event.preventDefault();
    event.stopPropagation();

}, true);
/* =====================================================
   14. CAMERA ACTIVATION
   ===================================================== */

async function startCamera() {

    if (!webcam || cameraStarting) return;

    if (cameraStream?.active) return;

    if (!navigator.mediaDevices?.getUserMedia) {

        alert("Camera access is unavailable. Please use HTTPS or localhost.");

        return;

    }

    cameraStarting = true;

    if (startCameraButton) {
        startCameraButton.disabled = true;
        startCameraButton.textContent = "Connecting...";
    }

    try {

        cameraStream = await navigator.mediaDevices.getUserMedia({

            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            },

            audio: false

        });

        webcam.srcObject = cameraStream;

        if (webcam.readyState < 1) {

            await new Promise((resolve, reject) => {

                webcam.onloadedmetadata = resolve;
                webcam.onerror = reject;

            });

        }

        await webcam.play();

        if (cameraOverlay) cameraOverlay.style.display = "none";

        if (startCameraButton) {
            startCameraButton.disabled = false;
            startCameraButton.textContent = "Camera Enabled";
        }

        if (stopCameraButton) {
            stopCameraButton.style.display = "inline-flex";
        }

        if (cameraStatus) cameraStatus.textContent = "VISION SYSTEM ACTIVE";
        if (visionStatus) visionStatus.textContent = "CAMERA ONLINE";

        if (gestureReadout) {
            gestureReadout.textContent = "CAMERA ONLINE · SHOW YOUR HAND";
        }

        // Lock physical controls after the browser permission click.
        lockKianaPhysicalInput();

        kianaProfile?.classList.add("kiana-camera-active");

        document.dispatchEvent(new CustomEvent("kiana-camera-started"));

        console.log("KIANA: Camera activated. Gesture-only controls enabled.");

    } catch (error) {

        console.error("KIANA camera error:", error);

        stopCamera();

        if (cameraStatus) cameraStatus.textContent = "CAMERA ERROR";

        alert(
            "KIANA could not access your camera. Check browser permissions and try again."
        );

    } finally {

        cameraStarting = false;

        if (startCameraButton) startCameraButton.disabled = false;

    }

}


/* =====================================================
   15. CAMERA SHUTDOWN
   ===================================================== */

function stopCamera() {


    unlockKianaPhysicalInput();

    kianaProfile?.classList.remove("kiana-camera-active");
    
    if (cameraStream) {

        cameraStream.getTracks().forEach(track => track.stop());

        cameraStream = null;

    }

    if (webcam) {

        webcam.pause();
        webcam.srcObject = null;

    }

    if (cameraOverlay) cameraOverlay.style.display = "flex";

    if (startCameraButton) {

        startCameraButton.style.display = "inline-flex";
        startCameraButton.disabled = false;
        startCameraButton.textContent = "Enable Camera";

    }

    if (stopCameraButton) stopCameraButton.style.display = "none";

    if (cameraStatus) cameraStatus.textContent = "SYSTEM STANDBY";
    if (visionStatus) visionStatus.textContent = "CAMERA OFF";

    if (gestureReadout) gestureReadout.textContent = "VISION SYSTEM STANDBY";

    document.dispatchEvent(new CustomEvent("kiana-camera-stopped"));

    console.log("KIANA: Camera stopped.");

}


startCameraButton?.addEventListener("click", startCamera);

stopCameraButton?.addEventListener("click", stopCamera);


/* =====================================================
   16. ENTER KIANA
   ===================================================== */

function activateGestureMode() {

    if (!gestureInterface) return;

    closeElementDetails();
    closeKianaProfile();

    kianaActive = true;

    document.body.classList.add("kiana-active", "gesture-mode");

    gestureInterface.setAttribute("aria-hidden", "false");

    displayKianaElements();

    if (cameraStatus) cameraStatus.textContent = "SYSTEM STANDBY";

    if (gestureReadout) {
        gestureReadout.textContent = "KIANA ONLINE · ENABLE VISION";
    }

    window.scrollTo({ top: 0, behavior: "instant" });

    console.log("KIANA: Interface activated.");

}


/* =====================================================
   17. EXIT KIANA
   ===================================================== */

function exitGestureMode() {

    stopCamera();

    unlockKianaPhysicalInput();

    closeKianaProfile();
    closeElementDetails();

    kianaActive = false;

    document.body.classList.remove("kiana-active", "gesture-mode");

    if (gestureInterface) {
        gestureInterface.setAttribute("aria-hidden", "true");
    }

    window.scrollTo({ top: 0, behavior: "instant" });

    console.log("KIANA: Interface deactivated.");

}


/* =====================================================
   18. GATEWAY NAVIGATION
   ===================================================== */

document.getElementById("gateway-unlock")
    ?.addEventListener("click", activateGestureMode);


document.getElementById("exit-gesture-mode")
    ?.addEventListener("click", exitGestureMode);


function enterGestureMode() {

    document.getElementById("gesture-gateway")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });

}


document.querySelector(".gesture-nav-link")
    ?.addEventListener("click", event => {

        event.preventDefault();
        enterGestureMode();

    });


document.getElementById("gateway-scroll-btn")
    ?.addEventListener("click", enterGestureMode);

    /* =====================================================
   19. KIANA INSTRUCTIONS
   ===================================================== */

// Instructions are already displayed on the KIANA interface.

/* =====================================================
   20. KEYBOARD SUPPORT OUTSIDE KIANA
   ===================================================== */

document.addEventListener("keydown", event => {

    if (
        !kianaActive &&
        event.key === "Escape" &&
        detailsPanel?.classList.contains("active")
    ) {

        closeElementDetails();

    }

});


/* =====================================================
   21. GLOBAL FUNCTION ACCESS
   ===================================================== */

window.openKianaElement = openKianaElement;
window.closeKianaProfile = closeKianaProfile;

window.activateGestureMode = activateGestureMode;
window.exitGestureMode = exitGestureMode;

window.startCamera = startCamera;
window.stopCamera = stopCamera;

window.showElementDetails = showElementDetails;
window.closeElementDetails = closeElementDetails;

window.displayKianaElements = displayKianaElements;
window.updateKianaDiscovery = updateKianaDiscovery;


/* =====================================================
   22. INITIALISE ELEMENTA
   ===================================================== */

installKianaDiscoveryInterface();

displayElements();
displayRareElements();
displayKianaElements();

console.log("--------------------------------");
console.log("ELEMENTA initialized.");
console.log("KIANA application engine loaded.");
console.log(`Element database: ${elements.length} elements.`);
console.log("Compact discovery interface installed.");
console.log("--------------------------------");
